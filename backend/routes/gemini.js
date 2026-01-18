const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { google } = require('googleapis');
const isAuthenticated = require('../middleware/authMiddleware');
const { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT } = require('../utils/tools');
const oauth2Client = require('../utils/googleClient');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to get header value
function getHeader(headers, name) {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

// Helper function to extract email body
function extractEmailBody(payload) {
  let body = '';
  
  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
  } else if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        break;
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === 'text/plain' && subPart.body && subPart.body.data) {
            body = Buffer.from(subPart.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }
    }
  }
  
  return body;
}

// Tool executor - runs the actual Gmail API calls
async function executeTool(toolName, args, session) {
  oauth2Client.setCredentials(session.tokens);
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  try {
    switch (toolName) {
      case 'searchEmails': {
        const maxResults = Math.min(args.maxResults || 5, 10);
        
        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          q: args.query,
          maxResults: maxResults
        });
        
        if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
          return { 
            success: true,
            emails: [], 
            message: `No emails found matching "${args.query}".` 
          };
        }
        
        // Get details for each message
        const emails = await Promise.all(
          listResponse.data.messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date', 'To']
            });
            
            const headers = detail.data.payload.headers;
            
            return {
              id: msg.id,
              threadId: msg.threadId,
              from: getHeader(headers, 'From'),
              to: getHeader(headers, 'To'),
              subject: getHeader(headers, 'Subject') || '(No Subject)',
              date: getHeader(headers, 'Date'),
              snippet: detail.data.snippet,
              labelIds: detail.data.labelIds || []
            };
          })
        );
        
        return { 
          success: true,
          emails,
          count: emails.length,
          query: args.query
        };
      }
      
      case 'readEmail': {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: args.emailId,
          format: 'full'
        });
        
        const headers = message.data.payload.headers;
        const body = extractEmailBody(message.data.payload);
        
        return { 
          success: true,
          email: {
            id: message.data.id,
            threadId: message.data.threadId,
            from: getHeader(headers, 'From'),
            to: getHeader(headers, 'To'),
            subject: getHeader(headers, 'Subject') || '(No Subject)',
            date: getHeader(headers, 'Date'),
            body: body || message.data.snippet,
            snippet: message.data.snippet,
            labelIds: message.data.labelIds || []
          }
        };
      }
      
      case 'draftReply': {
        const { to, subject, body, inReplyTo } = args;
        
        const emailLines = [
          `To: ${to}`,
          `Subject: ${subject.startsWith('Re: ') ? subject : `Re: ${subject}`}`,
          'Content-Type: text/plain; charset=utf-8',
          'MIME-Version: 1.0',
          '',
          body
        ];
        
        if (inReplyTo) {
          emailLines.splice(2, 0, `In-Reply-To: ${inReplyTo}`);
        }
        
        const email = emailLines.join('\r\n');
        const encodedEmail = Buffer.from(email).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        const draft = await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: encodedEmail
            }
          }
        });
        
        return {
          success: true,
          draft: {
            id: draft.data.id,
            to,
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            bodyPreview: body.slice(0, 100) + (body.length > 100 ? '...' : '')
          },
          message: 'Draft created successfully! You can find it in your Gmail Drafts folder.'
        };
      }
      
      default: 
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error.message);
    return { 
      success: false, 
      error: `Failed to execute ${toolName}: ${error.message}` 
    };
  }
}

// Protected Chat Route with Function Calling
router.post('/chat', isAuthenticated, async (req, res) => {
  const { message, history } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDefinitions }]
    });

    const chat = model.startChat({
      history: history || []
    });

    let result = await chat.sendMessage(message);
    let response = result.response;

    let loopCount = 0;
    const maxLoops = 5;
    
    while (response.functionCalls && response.functionCalls().length > 0 && loopCount < maxLoops) {
      loopCount++;
      const functionCall = response.functionCalls()[0];
      
      console.log(`Function call ${loopCount}:`, functionCall.name);
      
      res.write(`data: ${JSON.stringify({ 
        type: 'tool_call',
        toolCall: { 
          name: functionCall.name, 
          args: functionCall.args 
        }
      })}\n\n`);
      
      const toolResult = await executeTool(
        functionCall.name, 
        functionCall.args,
        req.session
      );
      
      res.write(`data: ${JSON.stringify({ 
        type: 'tool_result',
        toolResult: {
          name: functionCall.name,
          success: toolResult.success,
          emailCount: toolResult.emails?.length || (toolResult.email ? 1 : 0),
          emails: toolResult.emails || null,
          email: toolResult.email || null,
          draft: toolResult.draft || null
        }
      })}\n\n`);
      
      result = await chat.sendMessage([{
        functionResponse: {
          name: functionCall.name,
          response: toolResult
        }
      }]);
      response = result.response;
    }
    
    const text = response.text();
    
    res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Gemini Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
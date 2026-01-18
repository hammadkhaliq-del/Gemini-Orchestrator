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
  const header = headers.find(h => h. name.toLowerCase() === name.toLowerCase());
  return header ? header. value : '';
}

// Helper function to extract email body
function extractEmailBody(payload) {
  let body = '';
  
  if (payload.body && payload.body.data) {
    body = Buffer.from(payload.body. data, 'base64').toString('utf-8');
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
  
  console.log(`Executing tool: ${toolName} with args: `, args);
  
  try {
    switch (toolName) {
      case 'searchEmails':  {
        const maxResults = Math.min(args.maxResults || 5, 10);
        
        const listResponse = await gmail.users.messages.list({
          userId: 'me',
          q: args.query,
          maxResults: maxResults
        });
        
        if (!listResponse.data. messages || listResponse.data.messages.length === 0) {
          return { 
            success: true,
            emails: [], 
            message: `No emails found matching "${args.query}".` 
          };
        }
        
        // Get details for each message
        const emails = await Promise.all(
          listResponse.data.messages. map(async (msg) => {
            const detail = await gmail. users.messages.get({
              userId: 'me',
              id: msg.id,
              format: 'metadata',
              metadataHeaders: ['From', 'Subject', 'Date']
            });
            
            const headers = detail.data.payload. headers;
            
            return {
              id: msg.id,
              from: getHeader(headers, 'From'),
              subject: getHeader(headers, 'Subject') || '(No Subject)',
              date: getHeader(headers, 'Date'),
              snippet: detail.data.snippet
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
        const message = await gmail.users.messages. get({
          userId: 'me',
          id: args. emailId,
          format: 'full'
        });
        
        const headers = message.data.payload. headers;
        const body = extractEmailBody(message.data.payload);
        
        return { 
          success: true,
          email: {
            id:  message.data.id,
            from: getHeader(headers, 'From'),
            to: getHeader(headers, 'To'),
            subject: getHeader(headers, 'Subject') || '(No Subject)',
            date: getHeader(headers, 'Date'),
            body: body || message.data.snippet
          }
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

  // Setup SSE (Server-Sent Events) headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Initialize Gemini with function calling
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-001",
      systemInstruction: ORCHESTRATOR_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDefinitions }]
    });

    // Start chat with history
    const chat = model.startChat({
      history: history || []
    });

    // Send the user message
    let result = await chat.sendMessage(message);
    let response = result.response;

    // Handle function calls in a loop (for multi-step reasoning)
    let loopCount = 0;
    const maxLoops = 5; // Prevent infinite loops
    
    while (response.functionCalls && response.functionCalls().length > 0 && loopCount < maxLoops) {
      loopCount++;
      const functionCall = response.functionCalls()[0];
      
      console.log(`Function call ${loopCount}: `, functionCall.name);
      
      // Send tool call info to frontend
      res.write(`data: ${JSON.stringify({ 
        type: 'tool_call',
        toolCall: { 
          name: functionCall.name, 
          args: functionCall.args 
        }
      })}\n\n`);
      
      // Execute the tool
      const toolResult = await executeTool(
        functionCall.name, 
        functionCall.args,
        req.session
      );
      
      // Send tool result info to frontend
      res.write(`data: ${JSON.stringify({ 
        type: 'tool_result',
        toolResult:  {
          name: functionCall.name,
          success: toolResult.success,
          emailCount: toolResult.emails?.length || (toolResult.email ? 1 : 0)
        }
      })}\n\n`);
      
      // Send result back to Gemini
      result = await chat.sendMessage([{
        functionResponse: {
          name: functionCall.name,
          response: toolResult
        }
      }]);
      response = result.response;
    }
    
    // Get the final text response
    const text = response.text();
    
    // Send the final text response
    res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('Gemini Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error:  error.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
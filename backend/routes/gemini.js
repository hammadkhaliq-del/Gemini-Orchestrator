const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const isAuthenticated = require('../middleware/authMiddleware');
const { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT } = require('../utils/tools');
const oauth2Client = require('../utils/googleClient');

// Import new services
const GmailService = require('../services/gmail');
const CalendarService = require('../services/calendar');
const DriveService = require('../services/drive');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function executeTool(toolName, args, session) {
  oauth2Client.setCredentials(session.tokens);

  // Initialize services with the authenticated client
  const gmailService = new GmailService(oauth2Client);
  const calendarService = new CalendarService(oauth2Client);
  const driveService = new DriveService(oauth2Client);

  console.log(`Executing tool: ${toolName} with args: `, args);

  try {
    switch (toolName) {
      // === EMAIL TOOLS ===
      case 'searchEmails': {
        return await gmailService.searchEmails(args.query, args.maxResults);
      }

      case 'readEmail': {
        return await gmailService.readEmail(args.emailId);
      }

      case 'draftReply': {
        return await gmailService.draftReply(args.to, args.subject, args.body, args.inReplyTo);
      }

      // === CALENDAR TOOLS ===
      case 'getCalendarEvents': {
        return await calendarService.getEvents(args.timeMin, args.timeMax, args.maxResults, args.query);
      }

      case 'createCalendarEvent': {
        return await calendarService.createEvent(args);
      }

      // === DRIVE TOOLS ===
      case 'searchDriveFiles': {
        return await driveService.searchFiles(args.query, args.fileType, args.maxResults);
      }

      case 'getRecentDriveFiles': {
        return await driveService.getRecentFiles(args.maxResults, args.fileType);
      }

      case 'getDriveFileContent': {
        return await driveService.getFileContent(args.fileId);
      }

      case 'createDriveDocument': {
        return await driveService.createDocument(args.title, args.content);
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error.message);
    return { success: false, error: `Failed to execute ${toolName}: ${error.message}` };
  }
}



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

    const chat = model.startChat({ history: history || [] });
    let result = await chat.sendMessage(message);
    let response = result.response;

    let loopCount = 0;
    const maxLoops = 5;

    while (response.functionCalls() && response.functionCalls().length > 0 && loopCount < maxLoops) {
      loopCount++;
      const calls = response.functionCalls();
      const functionResponses = [];

      for (const call of calls) {
        console.log(`Tool Call: ${call.name}`);

        res.write(`data: ${JSON.stringify({
          type: 'tool_call',
          toolCall: { name: call.name, args: call.args }
        })}\n\n`);

        const toolResult = await executeTool(call.name, call.args, req.session);

        res.write(`data: ${JSON.stringify({
          type: 'tool_result',
          toolResult: {
            name: call.name,
            success: toolResult.success,
            emailCount: toolResult.emails?.length || (toolResult.email ? 1 : 0),
            eventCount: toolResult.events?.length || (toolResult.event ? 1 : 0),
            fileCount: toolResult.files?.length || (toolResult.file ? 1 : 0),
            emails: toolResult.emails || null,
            email: toolResult.email || null,
            draft: toolResult.draft || null,
            events: toolResult.events || null,
            event: toolResult.event || null,
            files: toolResult.files || null,
            file: toolResult.file || null,
            document: toolResult.document || null
          }
        })}\n\n`);

        functionResponses.push({
          functionResponse: { name: call.name, response: toolResult }
        });
      }

      result = await chat.sendMessage(functionResponses);
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
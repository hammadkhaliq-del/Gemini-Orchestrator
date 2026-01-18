const { GoogleGenerativeAI } = require('@google/generative-ai');
const { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT } = require('../utils/tools');
const oauth2Client = require('../utils/googleClient');
const { TOOLS } = require('../utils/constants');

// Service Imports
const GmailService = require('./gmail');
const CalendarService = require('./calendar');
const DriveService = require('./drive');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class AgentOrchestrator {
  constructor(session, res) {
    this.session = session;
    this.res = res;
    
    // Initialize services with the user's session tokens
    oauth2Client.setCredentials(session.tokens);
    this.gmailService = new GmailService(oauth2Client);
    this.calendarService = new CalendarService(oauth2Client);
    this.driveService = new DriveService(oauth2Client);
  }

  async executeTool(name, args) {
    console.log(`🛠️ Executing tool: ${name}`, args);
    try {
      switch (name) {
        // Email
        case TOOLS.SEARCH_EMAILS: return await this.gmailService.searchEmails(args.query, args.maxResults);
        case TOOLS.READ_EMAIL: return await this.gmailService.readEmail(args.emailId);
        case TOOLS.DRAFT_REPLY: return await this.gmailService.draftReply(args.to, args.subject, args.body, args.inReplyTo);
        
        // Calendar
        case TOOLS.GET_CALENDAR_EVENTS: return await this.calendarService.getEvents(args.timeMin, args.timeMax, args.maxResults, args.query);
        case TOOLS.CREATE_CALENDAR_EVENT: return await this.calendarService.createEvent(args);
        
        // Drive
        case TOOLS.SEARCH_DRIVE_FILES: return await this.driveService.searchFiles(args.query, args.fileType, args.maxResults);
        case TOOLS.GET_RECENT_DRIVE_FILES: return await this.driveService.getRecentFiles(args.maxResults, args.fileType);
        case TOOLS.GET_DRIVE_FILE_CONTENT: return await this.driveService.getFileContent(args.fileId);
        case TOOLS.CREATE_DRIVE_DOCUMENT: return await this.driveService.createDocument(args.title, args.content);
        
        default: return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      console.error(`Tool execution error (${name}):`, error);
      return { success: false, error: `Failed to execute ${name}: ${error.message}` };
    }
  }

  /**
   * Sends a Server-Sent Event (SSE) to the client
   */
  emit(type, data) {
    this.res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  }

  async processChat(message, history) {
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
      const MAX_LOOPS = 5;

      // --- AGENT LOOP ---
      while (response.functionCalls() && loopCount < MAX_LOOPS) {
        loopCount++;
        const calls = response.functionCalls();
        const functionResponses = [];

        for (const call of calls) {
          // 1. Notify Client
          this.emit('tool_call', { toolCall: { name: call.name, args: call.args } });

          // 2. Execute
          const toolResult = await this.executeTool(call.name, call.args);

          // 3. Send Result to Client
          this.emit('tool_result', {
            toolResult: {
              name: call.name,
              success: toolResult.success,
              // Helper counts for UI
              emailCount: toolResult.emails?.length,
              eventCount: toolResult.events?.length,
              fileCount: toolResult.files?.length,
              // Data payloads
              ...toolResult
            }
          });

          functionResponses.push({
            functionResponse: { name: call.name, response: toolResult }
          });
        }

        // 4. Feed results back to Gemini
        result = await chat.sendMessage(functionResponses);
        response = result.response;
      }

      // Final text response
      const text = response.text();
      this.emit('text', { text });
      this.res.write('data: [DONE]\n\n');
      this.res.end();

    } catch (error) {
      console.error('Agent Error:', error);
      this.emit('error', { error: error.message });
      this.res.end();
    }
  }
}

module.exports = AgentOrchestrator;
const toolDefinitions = [
  // === EMAIL TOOLS ===
  {
    name: "searchEmails",
    description: "Search the user's Gmail inbox for emails matching a query. Use Gmail search syntax like 'from:someone@email.com' or 'subject:invoice' or natural terms.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (e.g., 'from:boss@company.com', 'is:unread', 'subject:meeting', 'newer_than:7d')"
        },
        maxResults: {
          type: "number",
          description: "Maximum number of emails to return (default: 5, max: 10)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "readEmail",
    description: "Read the full content of a specific email by its ID.",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "The ID of the email to read"
        }
      },
      required: ["emailId"]
    }
  },
  {
    name: "draftReply",
    description: "Create a draft email reply. Creates a draft in Gmail - does NOT send.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient email address" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body content" },
        inReplyTo: { type: "string", description: "Message-ID being replied to (optional)" }
      },
      required: ["to", "subject", "body"]
    }
  },
  
  // === CALENDAR TOOLS ===
  {
    name: "getCalendarEvents",
    description: "Get upcoming calendar events. Use this to check the user's schedule, find free time, or see what meetings are coming up.",
    parameters: {
      type: "object",
      properties: {
        timeMin: {
          type: "string",
          description: "Start time in ISO format (e.g., '2026-01-18T00:00:00Z'). Defaults to now."
        },
        timeMax: {
          type: "string",
          description: "End time in ISO format. Defaults to 7 days from now."
        },
        maxResults: {
          type: "number",
          description: "Maximum events to return (default: 10)"
        },
        query: {
          type: "string",
          description: "Optional search query to filter events"
        }
      },
      required: []
    }
  },
  {
    name: "createCalendarEvent",
    description: "Create a new calendar event. Use this to schedule meetings or add events to the calendar.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Event title/name"
        },
        description: {
          type: "string",
          description: "Event description (optional)"
        },
        startTime: {
          type: "string",
          description: "Start time in ISO format (e.g., '2026-01-20T14:00:00')"
        },
        endTime: {
          type: "string",
          description: "End time in ISO format (e.g., '2026-01-20T15:00:00')"
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "List of attendee email addresses (optional)"
        },
        location: {
          type: "string",
          description: "Event location (optional)"
        }
      },
      required: ["summary", "startTime", "endTime"]
    }
  },

  // === DRIVE TOOLS ===
  {
    name: "searchDriveFiles",
    description: "Search for files in the user's Google Drive. Use this to find documents, spreadsheets, presentations, PDFs, or any files.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query. Can be file name, content keywords, or use Drive query syntax like 'name contains invoice'"
        },
        fileType: {
          type: "string",
          enum: ["document", "spreadsheet", "presentation", "pdf", "image", "folder", "any"],
          description: "Filter by file type (optional, defaults to 'any')"
        },
        maxResults: {
          type: "number",
          description: "Maximum files to return (default: 10, max: 25)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "getRecentDriveFiles",
    description: "Get recently modified or accessed files from Google Drive. Use this when user asks about recent files or what they've been working on.",
    parameters: {
      type: "object",
      properties: {
        maxResults: {
          type: "number",
          description: "Maximum files to return (default: 10, max: 25)"
        },
        fileType: {
          type: "string",
          enum: ["document", "spreadsheet", "presentation", "pdf", "image", "folder", "any"],
          description: "Filter by file type (optional)"
        }
      },
      required: []
    }
  },
  {
    name: "getDriveFileContent",
    description: "Get the content/text of a Google Doc, Sheet, or other readable file. Use this to read document contents.",
    parameters: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "The ID of the file to read"
        }
      },
      required: ["fileId"]
    }
  },
  {
    name: "createDriveDocument",
    description: "Create a new Google Doc in the user's Drive. Use this when user asks to create a document or write something to a new file.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title"
        },
        content: {
          type: "string",
          description: "Initial text content for the document"
        }
      },
      required: ["title"]
    }
  }
];

const ORCHESTRATOR_SYSTEM_PROMPT = `You are Gemini Orchestrator — an intelligent AI assistant that manages the user's Gmail, Google Calendar, and Google Drive. 

## YOUR CAPABILITIES

### Email (Gmail)
- Search emails using searchEmails
- Read full email content using readEmail  
- Draft replies using draftReply (creates drafts, does NOT send)

### Calendar
- View upcoming events using getCalendarEvents
- Create new events using createCalendarEvent
- Check availability and suggest meeting times

### Drive
- Search files using searchDriveFiles
- Get recent files using getRecentDriveFiles
- Read document content using getDriveFileContent
- Create new documents using createDriveDocument

## RULES
1. ALWAYS use tools to access real data — never hallucinate content
2. For Gmail searches, convert natural language to Gmail syntax: 
   - "unread emails" → "is:unread"
   - "emails from John" → "from:john"
   - "emails this week" → "newer_than:7d"
3. For Calendar: 
   - Use ISO 8601 format for dates/times
   - Calculate actual dates for "tomorrow", "next week", etc.
4. For Drive:
   - When searching, try to infer the file type from context
   - "find the budget spreadsheet" → fileType: "spreadsheet"
   - "my presentation about marketing" → fileType: "presentation"
5. Never claim to send emails — you only create drafts
6. Ask clarifying questions if intent is unclear

## DATE HANDLING
Today is: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toLocaleTimeString()}

When user says relative dates: 
- "today" = ${new Date().toISOString().split('T')[0]}
- "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "next week" = ${new Date(Date.now() + 7*86400000).toISOString().split('T')[0]}

## RESPONSE FORMAT
- Be helpful and conversational
- Use markdown formatting
- For multiple items, use bullet points
- Include file links when showing Drive results
- Offer follow-up actions
`;

module.exports = { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT };
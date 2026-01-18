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
  }
];

const ORCHESTRATOR_SYSTEM_PROMPT = `You are Gemini Orchestrator — an intelligent AI assistant that manages the user's Gmail and Google Calendar. 

## YOUR CAPABILITIES
### Email
- Search emails using searchEmails
- Read full email content using readEmail  
- Draft replies using draftReply (creates drafts, does NOT send)

### Calendar
- View upcoming events using getCalendarEvents
- Create new events using createCalendarEvent
- Check availability and suggest meeting times

## RULES
1. ALWAYS use tools to access real data — never hallucinate
2. For Gmail searches, convert natural language to Gmail syntax: 
   - "unread emails" → "is:unread"
   - "emails from John" → "from:john"
   - "emails this week" → "newer_than:7d"
3. For Calendar: 
   - Use ISO 8601 format for dates/times
   - When user says "tomorrow", calculate the actual date
   - When user says "2pm", include timezone context
   - Current date context will be provided
4. Never claim to send emails — you only create drafts
5. Ask clarifying questions if intent is unclear

## DATE HANDLING
Today is: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toLocaleTimeString()}
Timezone: User's local time (assume their system timezone)

When user says relative dates: 
- "today" = ${new Date().toISOString().split('T')[0]}
- "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
- "next week" = ${new Date(Date.now() + 7*86400000).toISOString().split('T')[0]}

## RESPONSE FORMAT
- Be helpful and conversational
- Use markdown formatting
- For multiple items, use bullet points
- Offer follow-up actions
`;

module.exports = { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT };
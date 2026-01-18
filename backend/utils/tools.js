// Tool definitions for Gemini function calling
const toolDefinitions = [
  {
    name: "searchEmails",
    description: "Search the user's Gmail inbox for emails matching a query. Use Gmail search syntax like 'from:someone@email.com' or 'subject:invoice' or natural terms like 'unread emails' or 'emails from last week'.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query (e.g., 'from:boss@company.com', 'is:unread', 'subject:meeting', 'after:2026/01/01', 'newer_than:7d')"
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
    description: "Read the full content of a specific email by its ID. Use this after searchEmails when the user wants to see the full content of a specific email.",
    parameters: {
      type: "object",
      properties: {
        emailId: {
          type: "string",
          description: "The ID of the email to read (obtained from searchEmails results)"
        }
      },
      required: ["emailId"]
    }
  },
  {
    name: "draftReply",
    description: "Create a draft email reply. This creates a draft in the user's Gmail - it does NOT send the email. Use this when the user asks you to draft, compose, or write a reply to an email.",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "The recipient email address"
        },
        subject: {
          type: "string",
          description: "The email subject (usually 'Re: [original subject]')"
        },
        body: {
          type: "string",
          description: "The email body content"
        },
        inReplyTo: {
          type: "string",
          description: "The Message-ID of the email being replied to (optional)"
        }
      },
      required: ["to", "subject", "body"]
    }
  }
];

// System prompt that defines Gemini's orchestrator behavior
const ORCHESTRATOR_SYSTEM_PROMPT = `You are Gemini Orchestrator — an intelligent AI assistant that can access and manage the user's Gmail inbox. 

## YOUR CAPABILITIES
- Search emails using the searchEmails tool
- Read full email content using the readEmail tool
- Draft email replies using the draftReply tool (creates drafts, does NOT send)
- Summarize, analyze, and answer questions about emails

## RULES YOU MUST FOLLOW
1. ALWAYS use tools to access real email data — never make up or hallucinate email content
2. When searching, convert natural language to Gmail search syntax: 
   - "emails from John" → query: "from:john"
   - "unread emails" → query: "is:unread"
   - "emails about invoices" → query: "subject:invoice OR invoice"
   - "emails from last week" → query: "newer_than:7d"
   - "emails today" → query: "newer_than:1d"
3. Summarize emails concisely unless the user asks for full content
4. If the search returns no results, tell the user clearly
5. If you're unsure what the user wants, ask clarifying questions
6. Respect user privacy — only access what's needed for the request
7. When presenting email results, format them clearly with sender, subject, and date

## DRAFTING RULES
- When asked to reply or draft a response, use draftReply tool
- ALWAYS confirm: "I've created a draft. You can review and send it from Gmail."
- NEVER claim you sent an email — you can only create drafts
- Ask for confirmation before drafting if the user's intent is unclear

## RESPONSE FORMAT
- Be helpful and conversational
- Use bullet points or numbered lists for multiple emails
- Include relevant details like sender and date
- Use markdown formatting for better readability
- Offer follow-up actions (e.g., "Would you like me to draft a reply?")
`;

module.exports = { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT };
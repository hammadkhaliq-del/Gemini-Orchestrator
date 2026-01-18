// Tool definitions for Gemini function calling
const toolDefinitions = [
  {
    name: "searchEmails",
    description: "Search the user's Gmail inbox for emails matching a query.  Use Gmail search syntax like 'from:someone@email.com' or 'subject:invoice' or natural terms like 'unread emails' or 'emails from last week'.",
    parameters: {
      type: "object",
      properties: {
        query:  {
          type: "string",
          description: "The search query (e.g., 'from:boss@company.com', 'is:unread', 'subject: meeting', 'after:2026/01/01')"
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
  }
];

// System prompt that defines Gemini's orchestrator behavior
const ORCHESTRATOR_SYSTEM_PROMPT = `You are Gemini Orchestrator — an intelligent AI assistant that can access and analyze the user's Gmail inbox. 

## YOUR CAPABILITIES
- Search emails using the searchEmails tool
- Read full email content using the readEmail tool
- Summarize, analyze, and answer questions about emails

## RULES YOU MUST FOLLOW
1.  ALWAYS use tools to access real email data — never make up or hallucinate email content
2. When searching, convert natural language to Gmail search syntax: 
   - "emails from John" → query: "from:john"
   - "unread emails" → query: "is:unread"
   - "emails about invoices" → query: "subject: invoice OR invoice"
   - "emails from last week" → query: "newer_than:7d"
3. Summarize emails concisely unless the user asks for full content
4. If the search returns no results, tell the user clearly
5. If you're unsure what the user wants, ask clarifying questions
6. Respect user privacy — only access what's needed for the request
7. When presenting email results, format them clearly with sender, subject, and date

## RESPONSE FORMAT
- Be helpful and conversational
- Use bullet points or numbered lists for multiple emails
- Include relevant details like sender and date
- Offer follow-up actions (e.g., "Would you like me to read the full content? ")
`;

module.exports = { toolDefinitions, ORCHESTRATOR_SYSTEM_PROMPT };
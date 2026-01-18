const { google } = require('googleapis');
const { simpleParser } = require('mailparser');

class GmailService {
  constructor(authClient) {
    this.gmail = google.gmail({ version: 'v1', auth: authClient });
  }

  // Helper to extract clean data from raw email
  async _parseEmailContent(rawBase64) {
    try {
      const decoded = Buffer.from(rawBase64, 'base64');
      const parsed = await simpleParser(decoded);
      return {
        subject: parsed.subject || '(No Subject)',
        from: parsed.from?.text || 'Unknown',
        to: parsed.to?.text || 'Unknown',
        date: parsed.date,
        body: parsed.text || parsed.html || '(No Content)', // Prefer text, fallback to HTML
        snippet: parsed.text ? parsed.text.slice(0, 150) : ''
      };
    } catch (e) {
      console.error("Parse Error:", e);
      return { body: "Error parsing email content." };
    }
  }

  async searchEmails(query, maxResults = 5) {
    const limit = Math.min(maxResults, 10);
    const listResponse = await this.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: limit
    });

    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      return { success: true, emails: [], message: `No emails found matching "${query}".` };
    }

    // Fetch details in parallel
    const emails = await Promise.all(
      listResponse.data.messages.map(async (msg) => {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full' // We need full format for the parser
        });
        
        // We use the snippet from metadata for the list view to be fast
        const headers = detail.data.payload.headers;
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader('from'),
          subject: getHeader('subject'),
          date: getHeader('date'),
          snippet: detail.data.snippet
        };
      })
    );

    return { success: true, emails, count: emails.length, query };
  }

  async readEmail(emailId) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'raw' // Get raw MIME for robust parsing
      });

      const parsedData = await this._parseEmailContent(response.data.raw);

      return {
        success: true,
        email: {
          id: emailId,
          ...parsedData
        }
      };
    } catch (error) {
      return { success: false, error: "Failed to read email." };
    }
  }

  async draftReply(to, subject, body, inReplyTo) {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject.startsWith('Re: ') ? subject : `Re: ${subject}`}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ];
    if (inReplyTo) emailLines.splice(2, 0, `In-Reply-To: ${inReplyTo}`);

    const emailContent = emailLines.join('\r\n');
    const encodedEmail = Buffer.from(emailContent).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const draft = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw: encodedEmail } }
    });

    return {
      success: true,
      draft: {
        id: draft.data.id,
        to,
        subject: subject,
        bodyPreview: body.slice(0, 100)
      }
    };
  }
}

module.exports = GmailService;
const { google } = require('googleapis');

// Helper function to extract email body
function extractEmailBody(payload) {
    let body = '';

    // Simple text body
    if (payload.body && payload.body.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }
    // Multipart message - find text/plain or text/html
    else if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                body = Buffer.from(part.body.data, 'base64').toString('utf-8');
                break;
            }
            // Nested parts (for complex emails)
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

// Helper function to get header value
function getHeader(headers, name) {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
}

class GmailService {
    constructor(authClient) {
        this.gmail = google.gmail({ version: 'v1', auth: authClient });
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

        const emails = await Promise.all(
            listResponse.data.messages.map(async (msg) => {
                const detail = await this.gmail.users.messages.get({
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

        return { success: true, emails, count: emails.length, query };
    }

    async readEmail(emailId) {
        const message = await this.gmail.users.messages.get({
            userId: 'me',
            id: emailId,
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
                subject: subject.startsWith('Re: ') ? subject : `Re: ${subject}`,
                bodyPreview: body.slice(0, 100) + (body.length > 100 ? '...' : '')
            },
            message: 'Draft created! Find it in your Gmail Drafts.'
        };
    }
}

module.exports = GmailService;

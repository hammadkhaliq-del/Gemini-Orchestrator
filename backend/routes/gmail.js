const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const oauth2Client = require('../utils/googleClient');
const isAuthenticated = require('../middleware/authMiddleware');

// Helper function to extract email body from payload
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

// Search emails
router.get('/search', isAuthenticated, async (req, res) => {
  try {
    const { query, maxResults = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Set credentials from session
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Search for messages
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(parseInt(maxResults), 10) // Cap at 10
    });
    
    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      return res.json({ emails: [], message: 'No emails found matching your search.' });
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
    
    res.json({ 
      emails,
      totalResults: listResponse.data.resultSizeEstimate || emails.length
    });
    
  } catch (error) {
    console.error('Gmail search error:', error.message);
    res.status(500).json({ error: 'Failed to search emails: ' + error.message });
  }
});

// Get single email content
router.get('/message/:id', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    
    oauth2Client.setCredentials(req.session.tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: id,
      format: 'full'
    });
    
    const headers = message.data.payload.headers;
    const body = extractEmailBody(message.data.payload);
    
    res.json({
      id: message.data.id,
      threadId: message.data.threadId,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject') || '(No Subject)',
      date: getHeader(headers, 'Date'),
      snippet: message.data.snippet,
      body: body || message.data.snippet,
      labelIds: message.data.labelIds || []
    });
    
  } catch (error) {
    console.error('Gmail message error:', error.message);
    res.status(500).json({ error: 'Failed to read email: ' + error.message });
  }
});

module.exports = router;
const oauth2Client = require('../utils/googleClient');

const isAuthenticated = async (req, res, next) => {
  // Check if session has tokens
  if (!req.session || !req.session.tokens) {
    return res.status(401).json({ error: 'Unauthorized:  No active session' });
  }

  // Set credentials from session
  oauth2Client. setCredentials(req.session. tokens);

  // Check if access token is expired and needs refresh
  const tokenExpiry = req.session.tokens.expiry_date;
  const isExpired = tokenExpiry && Date.now() >= tokenExpiry - 60000; // 1 min buffer

  if (isExpired && req.session.tokens.refresh_token) {
    try {
      console.log('Access token expired, refreshing...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update session with new tokens
      req.session.tokens = {
        ... req.session.tokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      };
      
      // Update oauth2Client with new credentials
      oauth2Client.setCredentials(req.session.tokens);
      console.log('Token refreshed successfully');
    } catch (error) {
      console.error('Token refresh failed:', error. message);
      return res.status(401).json({ 
        error: 'Session expired.  Please login again.',
        needsReauth: true 
      });
    }
  }

  next();
};

module.exports = isAuthenticated;
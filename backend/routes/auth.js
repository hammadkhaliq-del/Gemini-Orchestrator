const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const oauth2Client = require('../utils/googleClient');

// Redirect user to Google Consent Screen
router.get('/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    // Calendar scopes
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Critical for getting a refresh token
    scope: scopes,
    prompt: 'consent' // Forces refresh token to be sent on every login
  });
  
  res.redirect(url);
});

// Google Auth Callback
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store tokens in the session
    req.session.tokens = tokens;
    
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    // Store user profile info in the session
    req.session.user = userInfo.data;

    console.log(`User logged in: ${userInfo.data.email}`);
    res.redirect(process.env.FRONTEND_URL); 
  } catch (error) {
    console.error('Auth Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// Get current user status
router.get('/user', (req, res) => {
  res.json({ 
    isAuthenticated: !!req.session.tokens, 
    user: req.session.user || null 
  });
});

// Logout and clear session
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.clearCookie('connect.sid'); // Assuming default express-session cookie name
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
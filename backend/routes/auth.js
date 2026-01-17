const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const oauth2Client = require('../utils/googleClient'); // Import from utils

// 1. Redirect to Google
router.get('/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
    // Week 2 TODO: Add Gmail scopes here
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  res.redirect(url);
});

// 2. Callback from Google
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    // Store in session
    req.session.tokens = tokens;
    
    // Get basic user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    req.session.user = userInfo.data;

    console.log(`User logged in: ${userInfo.data.email}`);
    
    // Redirect to Frontend
    res.redirect(process.env.FRONTEND_URL); 
  } catch (error) {
    console.error('Auth Error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
});

// 3. Status Check (for Frontend)
router.get('/user', (req, res) => {
  res.json({ 
    isAuthenticated: !!req.session.tokens, 
    user: req.session.user || null 
  });
});

// 4. Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

module.exports = router;
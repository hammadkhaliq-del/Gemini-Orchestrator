require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const geminiRoutes = require('./routes/gemini');
const gmailRoutes = require('./routes/gmail');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true 
}));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave:  false,
  saveUninitialized: false,
  cookie:  { 
    secure: false, // Set 'true' if using https in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/api', geminiRoutes);
app.use('/api/gmail', gmailRoutes);

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Gemini Orchestrator Backend is Running.. .',
    version: '2.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Gmail integration enabled`);
});
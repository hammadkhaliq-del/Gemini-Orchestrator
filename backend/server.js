require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./routes/auth');
const geminiRoutes = require('./routes/gemini');
// const gmailRoutes = require('./routes/gmail'); // Uncomment in Week 2

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true 
}));
app.use(express.json());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set 'true' if using https in production
}));

// Routes
app.use('/auth', authRoutes);
app.use('/api', geminiRoutes);

// Test Route
app.get('/', (req, res) => {
  res.send('Gemini Cowork Backend is Running...');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
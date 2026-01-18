const express = require('express');
const router = express.Router();
const isAuthenticated = require('../middleware/authMiddleware');
const AgentOrchestrator = require('../services/AgentOrchestrator');

router.post('/chat', isAuthenticated, async (req, res) => {
  const { message, history } = req.body;

  // Setup SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Initialize and run Agent
  const agent = new AgentOrchestrator(req.session, res);
  await agent.processChat(message, history);
});

module.exports = router;
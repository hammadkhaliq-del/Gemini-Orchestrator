const isAuthenticated = (req, res, next) => {
  // Check if session has tokens
  if (req.session && req.session.tokens) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: No active session' });
  }
};

module.exports = isAuthenticated;
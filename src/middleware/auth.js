const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the Bearer token and loads the current user.
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user || !user.active) return res.status(401).json({ error: 'Account not found or disabled' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Role-based access control
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do this' });

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { auth, allow, wrap };

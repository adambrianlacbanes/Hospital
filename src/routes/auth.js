const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth, wrap } = require('../middleware/auth');

const publicUser = (u) => ({ id: u._id, username: u.username, fullName: u.fullName, role: u.role });

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username: String(username || '').toLowerCase().trim() });
  if (!user || !user.active || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  res.json({ token, user: publicUser(user) });
}));

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/change-password', auth, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (!(await bcrypt.compare(String(currentPassword || ''), req.user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  await req.user.save();
  res.json({ ok: true });
}));

module.exports = router;

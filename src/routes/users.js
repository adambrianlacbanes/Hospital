const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { allow, wrap } = require('../middleware/auth');
const { httpError } = require('../services/dates');

router.use(allow('admin'));

const clean = (u) => ({ _id: u._id, username: u.username, fullName: u.fullName, role: u.role, active: u.active, createdAt: u.createdAt });

router.get('/', wrap(async (req, res) => res.json((await User.find().sort({ username: 1 })).map(clean))));

router.post('/', wrap(async (req, res) => {
  const { username, fullName, role, password } = req.body;
  if (!password || password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  const u = await User.create({ username, fullName, role, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json(clean(u));
}));

router.put('/:id', wrap(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw httpError(404, 'User not found');
  const { fullName, role, active, password } = req.body;
  if (String(u._id) === String(req.user._id) && (active === false || (role && role !== 'admin'))) {
    throw httpError(400, 'You cannot disable or demote your own account');
  }
  if (fullName !== undefined) u.fullName = fullName;
  if (role) u.role = role;
  if (active !== undefined) u.active = !!active;
  if (password) {
    if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');
    u.passwordHash = await bcrypt.hash(password, 10);
  }
  await u.save();
  res.json(clean(u));
}));

module.exports = router;

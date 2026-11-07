const router = require('express').Router();
const mongoose = require('mongoose');
const { auth } = require('../middleware/auth');

// Public
router.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({ status: 'ok', database: states[mongoose.connection.readyState], dbName: mongoose.connection.name });
});
router.get('/config', (req, res) => res.json({ hospitalName: process.env.HOSPITAL_NAME || 'General Hospital' }));
router.use('/auth', require('./auth'));

// Everything below requires login
router.use(auth);
router.use('/dashboard', require('./dashboard'));
router.use('/', require('./master'));
router.use('/stock', require('./stock'));
router.use('/reports', require('./reports'));
router.use('/users', require('./users'));

module.exports = router;

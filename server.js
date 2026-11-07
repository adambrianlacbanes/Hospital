require('dotenv').config();
const path = require('path');
const express = require('express');
const { connectDB } = require('./src/config/db');
const { ensureAdmin } = require('./src/services/bootstrap');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/api', require('./src/routes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Central error handler
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const msg = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ error: msg });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(', ');
    return res.status(409).json({ error: `Duplicate value for: ${field}. It already exists.` });
  }
  if (err.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB();
  await ensureAdmin();
  app.listen(PORT, () => {
    console.log(`\n  Pharmacy & Medical Inventory System running`);
    console.log(`  Open:  http://localhost:${PORT}\n`);
  });
})();

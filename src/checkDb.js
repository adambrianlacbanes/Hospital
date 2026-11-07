// Run with:  npm run check-db   -> verifies the MongoDB Atlas connection only.
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');

(async () => {
  await connectDB();
  const ping = await mongoose.connection.db.admin().ping();
  const cols = await mongoose.connection.db.listCollections().toArray();
  console.log('[DB] Ping OK:', JSON.stringify(ping));
  console.log('[DB] Collections:', cols.map((c) => c.name).join(', ') || '(none yet)');
  await mongoose.disconnect();
})();

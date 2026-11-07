const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('\n[DB] MONGODB_URI is missing. Check your .env file.\n');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      dbName: process.env.DB_NAME || 'pharmacy_inventory',
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[DB] Connected to MongoDB Atlas  (database: ${mongoose.connection.name})`);
  } catch (err) {
    console.error('\n[DB] Could not connect to MongoDB Atlas:', err.message);
    console.error(`
  Common fixes:
   1. Atlas > Network Access > Add IP Address > "Allow access from anywhere" (0.0.0.0/0)
   2. Atlas > Database Access: check the username/password in MONGODB_URI (.env)
      (if the password has special characters like @ : / ? # it must be URL-encoded)
   3. Make sure your computer/school network is not blocking port 27017
`);
    process.exit(1);
  }
  mongoose.connection.on('disconnected', () => console.warn('[DB] Disconnected'));
  mongoose.connection.on('reconnected', () => console.log('[DB] Reconnected'));
}

module.exports = { connectDB };

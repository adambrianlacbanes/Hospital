const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Creates a default administrator the first time the system starts with an empty database.
async function ensureAdmin() {
  const count = await User.countDocuments();
  if (count > 0) return;
  await User.create({
    username: 'admin',
    fullName: 'System Administrator',
    passwordHash: await bcrypt.hash('admin123', 10),
    role: 'admin',
  });
  console.log('[Setup] Default admin created  ->  username: admin   password: admin123  (change it after login)');
}

module.exports = { ensureAdmin };

const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    username: { type: String, required: [true, 'Username is required'], unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: [true, 'Full name is required'], trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'pharmacist', 'staff'], default: 'staff' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);

const { Schema, model } = require('mongoose');

const supplierSchema = new Schema(
  {
    name: { type: String, required: [true, 'Supplier name is required'], unique: true, trim: true },
    contactPerson: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = model('Supplier', supplierSchema);

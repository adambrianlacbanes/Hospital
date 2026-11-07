const { Schema, model } = require('mongoose');

const categorySchema = new Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true },
    type: { type: String, enum: ['medicine', 'supply'], required: true },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);
categorySchema.index({ name: 1, type: 1 }, { unique: true });

module.exports = model('Category', categorySchema);

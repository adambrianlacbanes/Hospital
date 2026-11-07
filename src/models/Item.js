const { Schema, model } = require('mongoose');

// One collection for both medicines and medical supplies (distinguished by `type`).
const itemSchema = new Schema(
  {
    code: { type: String, required: [true, 'Item code is required'], unique: true, uppercase: true, trim: true },
    name: { type: String, required: [true, 'Item name is required'], trim: true },
    type: { type: String, enum: ['medicine', 'supply'], required: true },
    genericName: { type: String, trim: true, default: '' },
    dosageForm: { type: String, trim: true, default: '' }, // tablet, syrup, injection...
    strength: { type: String, trim: true, default: '' }, // 500 mg, 10 mg/mL...
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: [true, 'Category is required'] },
    unit: { type: String, required: [true, 'Unit is required'], trim: true }, // box, vial, pcs
    reorderLevel: { type: Number, required: true, min: [0, 'Reorder level cannot be negative'], default: 0 },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Item', itemSchema);

const { Schema, model } = require('mongoose');

// A batch/lot of an item with its own quantity and expiration date.
// Item on-hand = sum of its batch quantities.
const batchSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    batchNo: { type: String, required: true, trim: true, uppercase: true },
    expiryDate: { type: Date, default: null }, // required for medicines, optional for supplies
    quantity: { type: Number, required: true, min: [0, 'Quantity cannot be negative'], default: 0 },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    unitCost: { type: Number, min: 0, default: 0 },
    receivedDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
batchSchema.index({ item: 1, batchNo: 1 }, { unique: true });

module.exports = model('Batch', batchSchema);

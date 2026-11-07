const { Schema, model } = require('mongoose');

// Immutable inventory ledger: every stock-in, stock-out and adjustment is recorded here.
const transactionSchema = new Schema(
  {
    refNo: { type: String, required: true, unique: true },
    type: { type: String, enum: ['IN', 'OUT', 'ADJUST'], required: true, index: true },
    item: { type: Schema.Types.ObjectId, ref: 'Item', required: true, index: true },
    batch: { type: Schema.Types.ObjectId, ref: 'Batch', required: true },
    batchNo: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 }, // absolute quantity moved
    delta: { type: Number, required: true }, // signed change applied to stock
    balanceAfter: { type: Number, required: true }, // item on-hand after this transaction
    reference: { type: String, trim: true, default: '' }, // PO / DR / prescription / ward request no.
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    reason: { type: String, trim: true, default: '' }, // required for adjustments
    date: { type: Date, default: Date.now, index: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model('Transaction', transactionSchema);

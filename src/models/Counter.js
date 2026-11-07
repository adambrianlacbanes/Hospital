const { Schema, model } = require('mongoose');

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = model('Counter', counterSchema);

// Atomic sequential numbers, e.g. TXN-2026-000001
Counter.next = async function (key) {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return doc.seq;
};

module.exports = Counter;

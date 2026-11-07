const Item = require('../models/Item');
const Batch = require('../models/Batch');
const Transaction = require('../models/Transaction');
const Counter = require('../models/Counter');
const { today, addDays, parseDateOnly, nearExpiryDays, httpError } = require('./dates');

const isExpired = (b) => b.expiryDate && b.expiryDate < today();

async function nextRef() {
  const seq = await Counter.next('txn');
  return `TXN-${new Date().getUTCFullYear()}-${String(seq).padStart(6, '0')}`;
}

async function onHand(itemId) {
  const r = await Batch.aggregate([
    { $match: { item: itemId } },
    { $group: { _id: null, total: { $sum: '$quantity' } } },
  ]);
  return r[0] ? r[0].total : 0;
}

function positiveInt(value, label = 'Quantity') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${label} must be a whole number greater than 0`);
  return n;
}

async function getActiveItem(itemId) {
  const item = await Item.findById(itemId);
  if (!item) throw httpError(404, 'Item not found');
  if (!item.active) throw httpError(400, `${item.name} is inactive`);
  return item;
}

async function record(type, item, batch, qty, delta, user, extra = {}) {
  return Transaction.create({
    refNo: await nextRef(),
    type,
    item: item._id,
    batch: batch._id,
    batchNo: batch.batchNo,
    quantity: qty,
    delta,
    balanceAfter: await onHand(item._id),
    performedBy: user._id,
    performedByName: user.fullName,
    date: extra.date || new Date(),
    reference: extra.reference || '',
    supplier: extra.supplier || null,
    reason: extra.reason || '',
  });
}

// ---------- STOCK IN (receive) ----------
async function stockIn(body, user) {
  const item = await getActiveItem(body.itemId);
  const qty = positiveInt(body.quantity);
  const expiryDate = parseDateOnly(body.expiryDate);
  const batchNo = String(body.batchNo || '').trim().toUpperCase() || (item.type === 'supply' ? 'N/A' : '');

  if (!batchNo) throw httpError(400, 'Batch number is required');
  if (item.type === 'medicine' && !expiryDate) throw httpError(400, 'Expiration date is required for medicines');
  if (expiryDate && expiryDate < today()) throw httpError(400, 'Cannot receive stock that is already expired');

  let batch = await Batch.findOne({ item: item._id, batchNo });
  if (batch) {
    const sameExpiry = (batch.expiryDate && batch.expiryDate.getTime()) === (expiryDate && expiryDate.getTime());
    if (!sameExpiry && (batch.expiryDate || expiryDate)) {
      throw httpError(400, `Batch ${batchNo} already exists with a different expiration date`);
    }
    batch = await Batch.findByIdAndUpdate(batch._id, { $inc: { quantity: qty } }, { new: true });
  } else {
    batch = await Batch.create({
      item: item._id,
      batchNo,
      expiryDate,
      quantity: qty,
      supplier: body.supplierId || null,
      unitCost: Number(body.unitCost) || 0,
      receivedDate: parseDateOnly(body.date) || new Date(),
    });
  }
  return record('IN', item, batch, qty, qty, user, {
    reference: body.reference,
    supplier: body.supplierId || null,
    date: parseDateOnly(body.date) || new Date(),
    reason: body.remarks,
  });
}

// ---------- STOCK OUT (issue) - First-Expiry-First-Out, rejects unavailable stock ----------
async function stockOut(body, user) {
  const item = await getActiveItem(body.itemId);
  let remaining = positiveInt(body.quantity);
  const qty = remaining;
  if (!String(body.reference || '').trim()) throw httpError(400, 'Reference (e.g. request / prescription no.) is required');

  let batches;
  if (body.batchId) {
    const b = await Batch.findOne({ _id: body.batchId, item: item._id });
    if (!b) throw httpError(404, 'Batch not found for this item');
    if (isExpired(b)) throw httpError(400, `Batch ${b.batchNo} is expired and cannot be issued`);
    batches = [b];
  } else {
    batches = await Batch.find({ item: item._id, quantity: { $gt: 0 } });
    batches = batches.filter((b) => !isExpired(b));
    // earliest expiry first; batches without expiry go last
    batches.sort((a, b) => (a.expiryDate ? a.expiryDate.getTime() : Infinity) - (b.expiryDate ? b.expiryDate.getTime() : Infinity));
  }

  const available = batches.reduce((s, b) => s + b.quantity, 0);
  if (available < qty) {
    throw httpError(400, `Insufficient stock for ${item.name}. Requested ${qty}, available (non-expired) ${available} ${item.unit}`);
  }

  // Atomic decrements; roll back if a concurrent request took the stock first.
  const taken = [];
  try {
    for (const b of batches) {
      if (remaining === 0) break;
      const take = Math.min(remaining, b.quantity);
      const updated = await Batch.findOneAndUpdate({ _id: b._id, quantity: { $gte: take } }, { $inc: { quantity: -take } }, { new: true });
      if (!updated) throw httpError(409, 'Stock changed while processing. Please try again.');
      taken.push({ batch: updated, take });
      remaining -= take;
    }
    if (remaining > 0) throw httpError(409, 'Stock changed while processing. Please try again.');
  } catch (err) {
    for (const t of taken) await Batch.updateOne({ _id: t.batch._id }, { $inc: { quantity: t.take } });
    throw err;
  }

  const txns = [];
  for (const t of taken) {
    txns.push(await record('OUT', item, t.batch, t.take, -t.take, user, {
      reference: body.reference,
      reason: body.reason,
      date: parseDateOnly(body.date) || new Date(),
    }));
  }
  return txns;
}

// ---------- ADJUSTMENT (authorized, reason required) ----------
async function adjust(body, user) {
  const reason = String(body.reason || '').trim();
  if (!reason) throw httpError(400, 'A reason is required for stock adjustments');
  const newQty = Number(body.newQuantity);
  if (!Number.isInteger(newQty) || newQty < 0) throw httpError(400, 'New quantity must be a whole number, 0 or more');

  const batch = await Batch.findById(body.batchId);
  if (!batch) throw httpError(404, 'Batch not found');
  const item = await Item.findById(batch.item);
  const delta = newQty - batch.quantity;
  if (delta === 0) throw httpError(400, 'New quantity is the same as the current quantity');

  const updated = await Batch.findOneAndUpdate({ _id: batch._id, quantity: batch.quantity }, { $set: { quantity: newQty } }, { new: true });
  if (!updated) throw httpError(409, 'Stock changed while processing. Please reload and try again.');
  return record('ADJUST', item, updated, Math.abs(delta), delta, user, { reason, reference: body.reference });
}

// ---------- STOCK SUMMARY (on-hand, expired, near-expiry per item) ----------
async function stockSummary({ type, search, status, includeInactive } = {}) {
  const t0 = today();
  const near = addDays(t0, nearExpiryDays());
  const q = {};
  if (!includeInactive) q.active = true;
  if (type) q.type = type;
  if (search) {
    const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [{ name: rx }, { code: rx }, { genericName: rx }];
  }
  const items = await Item.find(q).populate('category', 'name').sort({ name: 1 }).lean();

  const agg = await Batch.aggregate([
    {
      $group: {
        _id: '$item',
        onHand: { $sum: '$quantity' },
        expired: { $sum: { $cond: [{ $and: [{ $ne: ['$expiryDate', null] }, { $lt: ['$expiryDate', t0] }] }, '$quantity', 0] } },
        nearExpiry: { $sum: { $cond: [{ $and: [{ $gte: ['$expiryDate', t0] }, { $lte: ['$expiryDate', near] }] }, '$quantity', 0] } },
        nextExpiry: { $min: { $cond: [{ $and: [{ $gt: ['$quantity', 0] }, { $gte: ['$expiryDate', t0] }] }, '$expiryDate', null] } },
      },
    },
  ]);
  const map = new Map(agg.map((a) => [String(a._id), a]));

  let rows = items.map((it) => {
    const a = map.get(String(it._id)) || { onHand: 0, expired: 0, nearExpiry: 0, nextExpiry: null };
    const usable = a.onHand - a.expired;
    let stockStatus = 'ok';
    if (usable <= 0) stockStatus = 'out';
    else if (usable <= it.reorderLevel) stockStatus = 'low';
    return { ...it, onHand: a.onHand, expired: a.expired, nearExpiry: a.nearExpiry, nextExpiry: a.nextExpiry, usable, stockStatus };
  });
  if (status) rows = rows.filter((r) => r.stockStatus === status);
  return rows;
}

module.exports = { stockIn, stockOut, adjust, stockSummary, onHand, isExpired };

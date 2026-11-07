// Master data: categories, suppliers, items (medicines & supplies), batches, transactions
const router = require('express').Router();
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const Item = require('../models/Item');
const Batch = require('../models/Batch');
const Transaction = require('../models/Transaction');
const { allow, wrap } = require('../middleware/auth');
const { stockSummary } = require('../services/stock');
const { today, addDays, nearExpiryDays, parseDateOnly, httpError } = require('../services/dates');

const manage = allow('admin', 'pharmacist');

// ---- Categories ----
router.get('/categories', wrap(async (req, res) => {
  const q = req.query.type ? { type: req.query.type } : {};
  res.json(await Category.find(q).sort({ type: 1, name: 1 }));
}));
router.post('/categories', manage, wrap(async (req, res) => res.status(201).json(await Category.create(req.body))));
router.put('/categories/:id', manage, wrap(async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!c) throw httpError(404, 'Category not found');
  res.json(c);
}));
router.delete('/categories/:id', manage, wrap(async (req, res) => {
  if (await Item.exists({ category: req.params.id })) throw httpError(400, 'Category is used by items and cannot be deleted');
  await Category.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ---- Suppliers ----
router.get('/suppliers', wrap(async (req, res) => res.json(await Supplier.find().sort({ name: 1 }))));
router.post('/suppliers', manage, wrap(async (req, res) => res.status(201).json(await Supplier.create(req.body))));
router.put('/suppliers/:id', manage, wrap(async (req, res) => {
  const s = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!s) throw httpError(404, 'Supplier not found');
  res.json(s);
}));
router.delete('/suppliers/:id', manage, wrap(async (req, res) => {
  if ((await Batch.exists({ supplier: req.params.id })) || (await Transaction.exists({ supplier: req.params.id }))) {
    throw httpError(400, 'Supplier has inventory history and cannot be deleted');
  }
  await Supplier.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
}));

// ---- Items (with live stock figures) ----
router.get('/items', wrap(async (req, res) => {
  const { type, search, status, all } = req.query;
  res.json(await stockSummary({ type, search, status, includeInactive: all === '1' }));
}));
router.get('/items/:id/batches', wrap(async (req, res) => {
  const batches = await Batch.find({ item: req.params.id, quantity: { $gt: 0 } }).lean();
  const t0 = today();
  batches.sort((a, b) => (a.expiryDate ? +a.expiryDate : Infinity) - (b.expiryDate ? +b.expiryDate : Infinity));
  res.json(batches.map((b) => ({ ...b, expired: !!(b.expiryDate && b.expiryDate < t0) })));
}));
router.post('/items', manage, wrap(async (req, res) => res.status(201).json(await Item.create(req.body))));
router.put('/items/:id', manage, wrap(async (req, res) => {
  const it = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!it) throw httpError(404, 'Item not found');
  res.json(it);
}));

// ---- Batches & expiry ----
// ?status=near|expired|ok|all   (default: only batches that still have stock)
router.get('/batches', wrap(async (req, res) => {
  const t0 = today();
  const near = addDays(t0, nearExpiryDays());
  const q = { quantity: { $gt: 0 } };
  const s = req.query.status;
  if (s === 'expired') q.expiryDate = { $ne: null, $lt: t0 };
  else if (s === 'near') q.expiryDate = { $gte: t0, $lte: near };
  else if (s === 'ok') q.$or = [{ expiryDate: null }, { expiryDate: { $gt: near } }];
  const batches = await Batch.find(q).populate('item', 'code name unit type strength dosageForm').populate('supplier', 'name').lean();
  const rows = batches.map((b) => {
    const days = b.expiryDate ? Math.round((b.expiryDate - t0) / 86400000) : null;
    return { ...b, daysLeft: days, expiryStatus: days === null ? 'none' : days < 0 ? 'expired' : days <= nearExpiryDays() ? 'near' : 'ok' };
  });
  rows.sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));
  res.json(rows);
}));

// ---- Transactions (inventory history) ----
router.get('/transactions', wrap(async (req, res) => {
  const { type, itemId, from, to, limit } = req.query;
  const q = {};
  if (type) q.type = type;
  if (itemId) q.item = itemId;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = parseDateOnly(from);
    if (to) q.date.$lt = addDays(parseDateOnly(to), 1);
  }
  const rows = await Transaction.find(q)
    .sort({ date: -1, createdAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 300, 2000))
    .populate('item', 'code name unit')
    .populate('supplier', 'name')
    .lean();
  res.json(rows);
}));

module.exports = router;

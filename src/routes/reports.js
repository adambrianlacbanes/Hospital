// JSON for printable reports; the browser renders and prints them.
const router = require('express').Router();
const Batch = require('../models/Batch');
const Transaction = require('../models/Transaction');
const { wrap } = require('../middleware/auth');
const { stockSummary } = require('../services/stock');
const { today, addDays, nearExpiryDays, parseDateOnly } = require('../services/dates');

router.get('/stock', wrap(async (req, res) => res.json(await stockSummary({ type: req.query.type }))));

router.get('/low-stock', wrap(async (req, res) => {
  const rows = await stockSummary({ type: req.query.type });
  res.json(rows.filter((r) => r.stockStatus !== 'ok').sort((a, b) => a.usable - b.usable));
}));

router.get('/expiry', wrap(async (req, res) => {
  const t0 = today();
  const near = addDays(t0, nearExpiryDays());
  const rows = await Batch.find({ quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: near } })
    .populate('item', 'code name unit type').populate('supplier', 'name').sort({ expiryDate: 1 }).lean();
  res.json(rows.map((b) => {
    const daysLeft = Math.round((b.expiryDate - t0) / 86400000);
    return { ...b, daysLeft, expiryStatus: daysLeft < 0 ? 'expired' : 'near' };
  }));
}));

router.get('/movements', wrap(async (req, res) => {
  const { from, to, type } = req.query;
  const q = {};
  if (type) q.type = type;
  if (from || to) {
    q.date = {};
    if (from) q.date.$gte = parseDateOnly(from);
    if (to) q.date.$lt = addDays(parseDateOnly(to), 1);
  }
  res.json(await Transaction.find(q).sort({ date: 1, createdAt: 1 }).populate('item', 'code name unit').populate('supplier', 'name').lean());
}));

module.exports = router;

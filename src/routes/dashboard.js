const router = require('express').Router();
const Batch = require('../models/Batch');
const Transaction = require('../models/Transaction');
const { wrap } = require('../middleware/auth');
const { stockSummary } = require('../services/stock');
const { today, addDays, nearExpiryDays } = require('../services/dates');

router.get('/', wrap(async (req, res) => {
  const t0 = today();
  const near = addDays(t0, nearExpiryDays());
  const items = await stockSummary({});
  const lowItems = items.filter((i) => i.stockStatus !== 'ok');

  const expiring = await Batch.find({ quantity: { $gt: 0 }, expiryDate: { $ne: null, $lte: near } })
    .populate('item', 'code name unit').sort({ expiryDate: 1 }).limit(8).lean();
  const expiredBatches = await Batch.countDocuments({ quantity: { $gt: 0 }, expiryDate: { $ne: null, $lt: t0 } });
  const nearBatches = await Batch.countDocuments({ quantity: { $gt: 0 }, expiryDate: { $gte: t0, $lte: near } });

  const recent = await Transaction.find().sort({ createdAt: -1 }).limit(8).populate('item', 'code name unit').lean();

  // last 7 days movement
  const start = addDays(t0, -6);
  const moves = await Transaction.aggregate([
    { $match: { date: { $gte: start }, type: { $in: ['IN', 'OUT'] } } },
    { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, t: '$type' }, qty: { $sum: '$quantity' } } },
  ]);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const key = addDays(start, i).toISOString().slice(0, 10);
    const get = (t) => (moves.find((m) => m._id.d === key && m._id.t === t) || {}).qty || 0;
    days.push({ date: key, in: get('IN'), out: get('OUT') });
  }

  res.json({
    nearExpiryDays: nearExpiryDays(),
    totals: {
      items: items.length,
      medicines: items.filter((i) => i.type === 'medicine').length,
      supplies: items.filter((i) => i.type === 'supply').length,
      low: items.filter((i) => i.stockStatus === 'low').length,
      out: items.filter((i) => i.stockStatus === 'out').length,
      nearBatches,
      expiredBatches,
    },
    lowItems: lowItems.sort((a, b) => a.usable - b.usable).slice(0, 8),
    expiring,
    recent,
    days,
  });
}));

module.exports = router;

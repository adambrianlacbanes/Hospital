const router = require('express').Router();
const { allow, wrap } = require('../middleware/auth');
const stock = require('../services/stock');

// Receiving and adjusting stock = pharmacist/admin. Issuing stock = any logged-in staff.
router.post('/in', allow('admin', 'pharmacist'), wrap(async (req, res) => res.status(201).json(await stock.stockIn(req.body, req.user))));
router.post('/out', wrap(async (req, res) => res.status(201).json(await stock.stockOut(req.body, req.user))));
router.post('/adjust', allow('admin', 'pharmacist'), wrap(async (req, res) => res.status(201).json(await stock.adjust(req.body, req.user))));

module.exports = router;

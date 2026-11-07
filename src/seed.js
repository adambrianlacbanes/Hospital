// Run with:  npm run seed
// Loads DEMO data (WARNING: clears existing inventory data and users in this database).
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');
const Supplier = require('./models/Supplier');
const Item = require('./models/Item');
const Batch = require('./models/Batch');
const Transaction = require('./models/Transaction');
const Counter = require('./models/Counter');
const stock = require('./services/stock');

const dayOffset = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  await connectDB();
  await Promise.all([User, Category, Supplier, Item, Batch, Transaction, Counter].map((m) => m.deleteMany({})));
  console.log('[Seed] Cleared old data');

  const hash = (p) => bcrypt.hash(p, 10);
  const [admin, pharmacist] = await User.insertMany([
    { username: 'admin', fullName: 'System Administrator', role: 'admin', passwordHash: await hash('admin123') },
    { username: 'pharmacist', fullName: 'Maria Santos, RPh', role: 'pharmacist', passwordHash: await hash('pharma123') },
    { username: 'nurse', fullName: 'Juan Dela Cruz, RN', role: 'staff', passwordHash: await hash('nurse123') },
  ]);

  const cats = {};
  for (const [name, type] of [
    ['Antibiotics', 'medicine'], ['Analgesics & Antipyretics', 'medicine'], ['Cardiovascular', 'medicine'],
    ['Antidiabetic', 'medicine'], ['IV Fluids & Injectables', 'medicine'], ['Respiratory', 'medicine'],
    ['Dressings & Wound Care', 'supply'], ['Syringes & Needles', 'supply'], ['PPE & Disposables', 'supply'], ['Diagnostics', 'supply'],
  ]) cats[name] = (await Category.create({ name, type }))._id;

  const sup = {};
  for (const s of [
    { name: 'MedPharma Distributors', contactPerson: 'R. Villanueva', phone: '0917-555-0101', email: 'sales@medpharma.example', address: 'Quezon City' },
    { name: 'HealthLine Supplies Inc.', contactPerson: 'A. Reyes', phone: '0918-555-0202', email: 'orders@healthline.example', address: 'Makati City' },
    { name: 'Vita Generics Corp.', contactPerson: 'L. Cruz', phone: '0920-555-0303', email: 'info@vitagenerics.example', address: 'Cebu City' },
  ]) sup[s.name] = (await Supplier.create(s))._id;

  const items = [
    ['MED-001', 'Amoxicillin', 'medicine', 'Amoxicillin', 'Capsule', '500 mg', 'Antibiotics', 'box', 30],
    ['MED-002', 'Paracetamol', 'medicine', 'Acetaminophen', 'Tablet', '500 mg', 'Analgesics & Antipyretics', 'box', 50],
    ['MED-003', 'Ibuprofen', 'medicine', 'Ibuprofen', 'Tablet', '400 mg', 'Analgesics & Antipyretics', 'box', 25],
    ['MED-004', 'Amlodipine', 'medicine', 'Amlodipine besylate', 'Tablet', '10 mg', 'Cardiovascular', 'box', 20],
    ['MED-005', 'Metformin', 'medicine', 'Metformin HCl', 'Tablet', '500 mg', 'Antidiabetic', 'box', 20],
    ['MED-006', 'Ceftriaxone', 'medicine', 'Ceftriaxone sodium', 'Injection', '1 g vial', 'Antibiotics', 'vial', 40],
    ['MED-007', 'Salbutamol Nebule', 'medicine', 'Salbutamol', 'Nebule', '2.5 mg/2.5 mL', 'Respiratory', 'box', 15],
    ['MED-008', 'Plain Normal Saline', 'medicine', 'Sodium chloride 0.9%', 'IV Solution', '1 L', 'IV Fluids & Injectables', 'bottle', 60],
    ['SUP-001', 'Disposable Syringe 3 mL', 'supply', '', '', '3 mL', 'Syringes & Needles', 'box', 40],
    ['SUP-002', 'Surgical Gloves (Medium)', 'supply', '', '', 'Medium', 'PPE & Disposables', 'box', 30],
    ['SUP-003', 'Sterile Gauze Pads 4x4', 'supply', '', '', '4x4 in', 'Dressings & Wound Care', 'pack', 50],
    ['SUP-004', 'Face Mask 3-ply', 'supply', '', '', '', 'PPE & Disposables', 'box', 40],
    ['SUP-005', 'Blood Glucose Test Strips', 'supply', '', '', '50s', 'Diagnostics', 'box', 10],
  ];
  const it = {};
  for (const [code, name, type, genericName, dosageForm, strength, cat, unit, reorderLevel] of items) {
    it[code] = await Item.create({ code, name, type, genericName, dosageForm, strength, category: cats[cat], unit, reorderLevel });
  }

  // stock-in through the real service so the transaction ledger is created
  const rec = async (code, batchNo, expiry, qty, supplier, ref) =>
    stock.stockIn({ itemId: it[code]._id, batchNo, expiryDate: expiry, quantity: qty, supplierId: sup[supplier], reference: ref, date: dayOffset(-20) }, pharmacist);

  await rec('MED-001', 'AMX-2601', dayOffset(300), 120, 'MedPharma Distributors', 'PO-1001');
  await rec('MED-002', 'PCM-2511', dayOffset(45), 40, 'Vita Generics Corp.', 'PO-1002');      // near expiry
  await rec('MED-002', 'PCM-2603', dayOffset(400), 90, 'Vita Generics Corp.', 'PO-1002');
  await rec('MED-003', 'IBU-2602', dayOffset(220), 15, 'Vita Generics Corp.', 'PO-1003');      // low stock
  await rec('MED-004', 'AML-2512', dayOffset(60), 35, 'MedPharma Distributors', 'PO-1004');    // near expiry
  await rec('MED-005', 'MET-2604', dayOffset(500), 80, 'MedPharma Distributors', 'PO-1005');
  await rec('MED-006', 'CTX-2605', dayOffset(180), 25, 'MedPharma Distributors', 'PO-1006');   // low stock
  await rec('MED-008', 'NSS-2606', dayOffset(365), 200, 'HealthLine Supplies Inc.', 'PO-1007');
  await rec('SUP-001', 'SYR-0001', dayOffset(700), 100, 'HealthLine Supplies Inc.', 'PO-1008');
  await rec('SUP-002', 'N/A', null, 20, 'HealthLine Supplies Inc.', 'PO-1009');                // low stock
  await rec('SUP-003', 'GZE-0001', dayOffset(600), 150, 'HealthLine Supplies Inc.', 'PO-1010');
  await rec('SUP-004', 'N/A', null, 120, 'HealthLine Supplies Inc.', 'PO-1011');
  // MED-007 and SUP-005 intentionally left at zero -> "Out of stock" demo

  // An already-expired batch (inserted directly, since receiving expired stock is blocked)
  const exp = await Batch.create({ item: it['MED-007']._id, batchNo: 'SAL-2410', expiryDate: new Date(dayOffset(-15) + 'T00:00:00Z'), quantity: 12, supplier: sup['MedPharma Distributors'] });
  await Transaction.create({ refNo: 'TXN-SEED-EXP', type: 'IN', item: it['MED-007']._id, batch: exp._id, batchNo: exp.batchNo, quantity: 12, delta: 12, balanceAfter: 12, reference: 'PO-0900', performedBy: pharmacist._id, performedByName: pharmacist.fullName, date: new Date(dayOffset(-120) + 'T00:00:00Z') });

  // a few issues
  await stock.stockOut({ itemId: it['MED-002']._id, quantity: 20, reference: 'RX-20261', reason: 'Ward 3 - Pediatrics' }, admin);
  await stock.stockOut({ itemId: it['MED-001']._id, quantity: 10, reference: 'RX-20262', reason: 'Emergency Room' }, admin);
  await stock.stockOut({ itemId: it['SUP-001']._id, quantity: 30, reference: 'REQ-5501', reason: 'Outpatient Dept.' }, admin);

  console.log('[Seed] Demo data loaded.');
  console.log('       Logins ->  admin / admin123   |   pharmacist / pharma123   |   nurse / nurse123');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

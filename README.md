# Hospital Information System — Pharmacy & Medical Inventory Management (Subsystem)

Manages medicines, medical supplies, stock levels and inventory transactions.
**Stack (from the proposal):** Node.js · Express · MongoDB Atlas (Mongoose) · Visual Studio Code · Git

## Features
| Proposal functionality | Where in the system |
|---|---|
| Medicine records | Items → type *Medicine* (code, dosage form, strength, category, unit, reorder level) |
| Medical supplies | Items → type *Supply* |
| Supplier records | Suppliers |
| Stock In / Out | Receive Stock, Issue Stock (rejects unavailable or expired stock, uses earliest-expiry batch first) |
| Batch & expiry | Batches & Expiry (flags near-expiry and expired) |
| Stock monitoring + adjustments | Dashboard, Items (low / out of stock), Adjustments (reason required) |
| Reports & access | Reports (Stock, Low-stock, Expiry, Movement — Print or CSV); roles: Administrator, Pharmacist, Staff |

## Run it step by step

### 1. Install the tools (once)
- Node.js LTS (v18 or newer): https://nodejs.org
- Visual Studio Code: https://code.visualstudio.com
- Git (optional, for version control): https://git-scm.com

### 2. Open the project in VS Code
1. Unzip `hospital-pharmacy-inventory.zip`.
2. VS Code → **File → Open Folder…** → choose the `hospital-pharmacy-inventory` folder.
3. Open the terminal: **Terminal → New Terminal**.

### 3. Allow your computer to reach MongoDB Atlas (important!)
1. Go to https://cloud.mongodb.com → your project → **Network Access**.
2. **Add IP Address** → **Allow Access From Anywhere** (`0.0.0.0/0`) → Confirm.
   (Without this step the app shows a connection error.)
3. **Database Access** → confirm the user `adambrianlacbanes401_db_user` exists with the password in `.env`.

### 4. Install dependencies
```bash
npm install
```

### 5. Check the MongoDB connection
```bash
npm run check-db
```
You should see `[DB] Connected to MongoDB Atlas` and `Ping OK`.

### 6. (Optional) Load demo data
```bash
npm run seed
```
This **clears** the database and adds sample medicines, supplies, batches, transactions and 3 users.
Skip it if you want to start empty (a default admin is created automatically).

### 7. Start the system
```bash
npm start
```
Open **http://localhost:3000**

| Login | Username | Password | Can do |
|---|---|---|---|
| Administrator | `admin` | `admin123` | everything, manage users |
| Pharmacist* | `pharmacist` | `pharma123` | records, receive, issue, adjust, reports |
| Staff* | `nurse` | `nurse123` | view, issue stock, reports |

\*created by `npm run seed`. **Change the default passwords** (top-right → Password).

For automatic restart while editing code, use `npm run dev`.

## Project structure
```
server.js            Express app entry point
.env                 MongoDB URI, port, secrets (never commit/share this file)
src/config/db.js     MongoDB Atlas connection
src/models/          User, Category, Supplier, Item, Batch, Transaction, Counter
src/services/stock.js  Stock in / out (FEFO) / adjustments / stock summary
src/routes/          REST API (auth, items, stock, reports, users, dashboard)
src/seed.js          Demo data loader
public/              Web interface (HTML, CSS, JS)
```

## Database collections (MongoDB Atlas → database `pharmacy_inventory`)
`users`, `categories`, `suppliers`, `items`, `batches`, `transactions`, `counters`.
Item on-hand quantity = sum of its batch quantities; every change creates an immutable `transactions` record.

## Integrating with other Hospital Information System modules
This is a subsystem exposing a REST API under `/api` (JWT login at `POST /api/auth/login`).
Other modules (e.g. Patient / Billing) can call `POST /api/stock/out` with a prescription number as `reference`,
and `GET /api/items` for live availability. Health check: `GET /api/health`.

## Troubleshooting
- **`querySrv ENOTFOUND` / `ETIMEDOUT` / "Could not connect"** → do step 3; try another network or mobile hotspot (some school networks block Atlas).
- **`bad auth`** → wrong username/password in `.env`.
- **Port in use** → change `PORT` in `.env`.
- **Security:** the DB password was shared in plain text while building this — in Atlas → Database Access, change that password, then update `.env`.

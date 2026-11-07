/* Pharmacy & Medical Inventory Management System - front end (vanilla JS, no build step) */
'use strict';

const state = { user: null, hospital: 'General Hospital' };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');
const todayStr = () => new Date().toLocaleDateString('en-CA');
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  items: '<path d="M10.5 20.5 3.5 13.5a4.9 4.9 0 0 1 7-7l7 7a4.9 4.9 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/>',
  in: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  out: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  adjust: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  batches: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  suppliers: '<path d="M1 6h13v10H1z"/><path d="M14 9h4l4 4v3h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  categories: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  reports: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};
const icon = (n) => `<svg viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

/* ---------------- API ---------------- */
async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('pmis_token');
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { logout(true); throw new Error(data.error || 'Please log in'); }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const qs = (o) => { const p = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => v && p.set(k, v)); const s = p.toString(); return s ? '?' + s : ''; };

/* ---------------- UI helpers ---------------- */
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 6000 : 3500);
}
const pill = (kind, text) => `<span class="pill ${kind}">${esc(text)}</span>`;
const stockPill = (s) => ({ ok: pill('ok', 'In stock'), low: pill('warn', 'Low stock'), out: pill('danger', 'Out of stock') }[s]);
const expiryPill = (st, days) =>
  st === 'expired' ? pill('danger', `Expired ${Math.abs(days)}d ago`) : st === 'near' ? pill('warn', `${days}d left`) : st === 'ok' ? pill('ok', `${days}d left`) : pill('gray', 'No expiry');
const typePill = (t) => (t === 'medicine' ? pill('info', 'Medicine') : pill('gray', 'Supply'));
const roleLabel = { admin: 'Administrator', pharmacist: 'Pharmacist', staff: 'Staff' };
const can = (...roles) => roles.includes(state.user.role);

function table(heads, rows, empty = 'Nothing to show yet.') {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="table-wrap"><table><thead><tr>${heads.map((h) => `<th class="${h.startsWith('>') ? 'right' : ''}">${esc(h.replace(/^>/, ''))}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div>${actions}</div></div>`;
const field = (label, input, cls = '') => `<div class="field ${cls}"><label>${esc(label)}</label>${input}</div>`;
const opts = (list, val, label, sel) => list.map((o) => `<option value="${esc(o[val])}" ${String(o[val]) === String(sel) ? 'selected' : ''}>${esc(typeof label === 'function' ? label(o) : o[label])}</option>`).join('');

function modal(title, bodyHtml, { onSubmit, submitText = 'Save', wide } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<form class="modal" ${wide ? 'style="max-width:680px"' : ''}><div class="modal-h"><h3>${esc(title)}</h3><button type="button" class="x" aria-label="Close">&times;</button></div><div class="modal-b">${bodyHtml}</div><div class="modal-f"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">${esc(submitText)}</button></div></form>`;
  document.body.append(ov);
  const close = () => ov.remove();
  $('.x', ov).onclick = close; $('[data-close]', ov).onclick = close;
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  $('form', ov).onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('[type=submit]', ov); btn.disabled = true;
    try { await onSubmit(Object.fromEntries(new FormData(e.target).entries()), close); }
    catch (err) { toast(err.message, 'error'); }
    btn.disabled = false;
  };
  const first = $('input:not([type=hidden]), select, textarea', ov); first && first.focus();
  return ov;
}

/* Searchable item picker (input + datalist) */
function itemPicker(items, id = 'pick') {
  const label = (i) => `${i.code} · ${i.name}${i.strength ? ' ' + i.strength : ''}`;
  return {
    html: `<input id="${id}" list="${id}-dl" placeholder="Type item code or name…" autocomplete="off" required /><datalist id="${id}-dl">${items.map((i) => `<option value="${esc(label(i))}"></option>`).join('')}</datalist>`,
    resolve: (text) => items.find((i) => label(i) === text.trim()),
  };
}

/* ---------------- Auth / shell ---------------- */
function logout(expired) {
  localStorage.removeItem('pmis_token'); state.user = null;
  renderLogin(expired ? 'Your session has ended. Please log in again.' : '');
}

function renderLogin(msg = '') {
  $('#app').innerHTML = `
  <div class="login">
    <div class="login-brand">
      <div class="logo"><div class="logo-mark"><svg viewBox="0 0 24 24"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg></div><span>${esc(state.hospital)}</span></div>
      <div><h1>Pharmacy &amp; Medical <span>Inventory</span> Management</h1><p style="margin-top:14px">A subsystem of the Hospital Information System. Track medicines, supplies, batches and expiry dates with a full audit trail.</p></div>
      <div class="tag-row"><span>Stock in / out</span><span>Batch &amp; expiry</span><span>Low-stock alerts</span><span>Printable reports</span></div>
    </div>
    <div class="login-form-wrap"><form class="login-form" id="lf">
      <h2>Sign in</h2><p class="muted" style="margin:0 0 22px">Authorized hospital staff only.</p>
      ${msg ? `<div class="notice">${esc(msg)}</div>` : ''}
      ${field('Username', '<input name="username" autocomplete="username" required autofocus />')}
      ${field('Password', '<input name="password" type="password" autocomplete="current-password" required />')}
      <button class="btn block" type="submit">Sign in</button>
      <div class="hint">First time? Default admin → <b>admin</b> / <b>admin123</b>. Change it after logging in.</div>
    </form></div>
  </div>`;
  $('#lf').onsubmit = async (e) => {
    e.preventDefault(); const btn = $('button', e.target); btn.disabled = true;
    try {
      const r = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      localStorage.setItem('pmis_token', r.token); state.user = r.user; location.hash = '#/dashboard'; renderShell();
    } catch (err) { toast(err.message, 'error'); btn.disabled = false; }
  };
}

const NAV = [
  ['Overview', [['dashboard', 'Dashboard', 'dashboard']]],
  ['Inventory', [['items', 'Items', 'items'], ['batches', 'Batches & Expiry', 'batches'], ['transactions', 'Transactions', 'history']]],
  ['Stock Operations', [['stock-in', 'Receive Stock', 'in', ['admin', 'pharmacist']], ['stock-out', 'Issue Stock', 'out'], ['adjust', 'Adjustments', 'adjust', ['admin', 'pharmacist']]]],
  ['Records', [['suppliers', 'Suppliers', 'suppliers'], ['categories', 'Categories', 'categories']]],
  ['Reports & Admin', [['reports', 'Reports', 'reports'], ['users', 'Users', 'users', ['admin']]]],
];

function renderShell() {
  const nav = NAV.map(([label, links]) => {
    const vis = links.filter((l) => !l[3] || l[3].includes(state.user.role));
    return vis.length ? `<div class="nav-label">${label}</div>` + vis.map(([id, text, ic]) => `<a href="#/${id}" data-route="${id}">${icon(ic)}<span>${text}</span></a>`).join('') : '';
  }).join('');
  const initials = state.user.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="side">
      <div class="logo"><div class="logo-mark"><svg viewBox="0 0 24 24" style="fill:var(--brand)"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/></svg></div><div>Pharmacy &amp; Inventory<small>${esc(state.hospital)}</small></div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot">HIS subsystem · v1.0</div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="crumbs"><button class="btn ghost sm menu-btn" id="menu">${icon('menu')}</button><span class="hide-sm">Hospital Information System</span><span class="hide-sm">›</span><span class="hide-sm">Pharmacy &amp; Medical Inventory</span><span class="hide-sm">›</span><b id="crumb"></b></div>
        <div class="user-chip"><div class="who"><b>${esc(state.user.fullName)}</b><span>${roleLabel[state.user.role]}</span></div><div class="avatar">${esc(initials)}</div>
          <button class="btn ghost sm" id="pw">Password</button><button class="btn ghost sm" id="out">Log out</button></div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
  $('#out').onclick = () => logout();
  $('#menu').onclick = () => $('#side').classList.toggle('open');
  $('#side').onclick = (e) => { if (e.target.closest('a')) $('#side').classList.remove('open'); };
  $('#pw').onclick = changePassword;
  route();
}

function changePassword() {
  modal('Change password', field('Current password', '<input name="currentPassword" type="password" required />') + field('New password (min. 6 characters)', '<input name="newPassword" type="password" minlength="6" required />'), {
    submitText: 'Update password',
    onSubmit: async (d, close) => { await api('/auth/change-password', { method: 'POST', body: d }); close(); toast('Password updated', 'success'); },
  });
}

/* ---------------- Router ---------------- */
const pages = {};
async function route() {
  if (!state.user) return;
  const id = (location.hash.replace('#/', '') || 'dashboard').split('?')[0];
  const page = pages[id] || pages.dashboard;
  const link = $(`[data-route="${pages[id] ? id : 'dashboard'}"]`);
  $$('.nav a').forEach((a) => a.classList.toggle('active', a === link));
  $('#crumb').textContent = link ? link.textContent : 'Dashboard';
  $('#view').innerHTML = '<div class="empty">Loading…</div>';
  try { await page($('#view')); } catch (err) { $('#view').innerHTML = `<div class="card"><div class="empty">Could not load this page: ${esc(err.message)}</div></div>`; }
}
window.addEventListener('hashchange', route);

/* ---------------- Dashboard ---------------- */
pages.dashboard = async (v) => {
  const d = await api('/dashboard');
  const t = d.totals;
  v.innerHTML = `${pageHead('Dashboard', `Inventory status as of ${fmtDate(new Date())}`)}
  <div class="grid kpis">
    <div class="card kpi"><div class="lbl">Active items</div><div class="num">${num(t.items)}</div><div class="sub">${t.medicines} medicines · ${t.supplies} supplies</div></div>
    <div class="card kpi warn"><div class="lbl">Low stock</div><div class="num">${num(t.low)}</div><div class="sub">at or below reorder level</div></div>
    <div class="card kpi danger"><div class="lbl">Out of stock</div><div class="num">${num(t.out)}</div><div class="sub">no usable quantity</div></div>
    <div class="card kpi warn"><div class="lbl">Near expiry</div><div class="num">${num(t.nearBatches)}</div><div class="sub">batches within ${d.nearExpiryDays} days</div></div>
    <div class="card kpi danger"><div class="lbl">Expired batches</div><div class="num">${num(t.expiredBatches)}</div><div class="sub">still holding stock</div></div>
  </div>
  <div class="grid two-wide" style="margin-bottom:16px">
    <div class="card"><div class="card-h"><h3>Stock movement · last 7 days</h3><div class="legend"><span><i style="background:#0d6b66"></i>Received</span><span><i style="background:#e0944a"></i>Issued</span></div></div><div class="card-b">${chart(d.days)}</div></div>
    <div class="card"><div class="card-h"><h3>Needs reordering</h3><a class="btn ghost sm" href="#/reports">Report</a></div>
      ${table(['Item', '>Usable', '>Reorder'], d.lowItems.map((i) => `<tr><td class="item-name"><b>${esc(i.name)}</b><span class="mono">${esc(i.code)}</span></td><td class="right"><b>${num(i.usable)}</b></td><td class="right">${num(i.reorderLevel)}</td></tr>`), 'All items are above their reorder level 🎉')}</div>
  </div>
  <div class="grid two">
    <div class="card"><div class="card-h"><h3>Expiring &amp; expired batches</h3><a class="btn ghost sm" href="#/batches">View all</a></div>
      ${table(['Item', 'Batch', '>Qty', 'Expiry'], d.expiring.map((b) => { const days = Math.round((new Date(b.expiryDate) - new Date(todayStr() + 'T00:00:00Z')) / 864e5); return `<tr><td class="item-name"><b>${esc(b.item.name)}</b></td><td class="mono">${esc(b.batchNo)}</td><td class="right">${num(b.quantity)}</td><td>${expiryPill(days < 0 ? 'expired' : 'near', days)}</td></tr>`; }), 'No batches are close to expiry.')}</div>
    <div class="card"><div class="card-h"><h3>Recent transactions</h3><a class="btn ghost sm" href="#/transactions">History</a></div>
      ${table(['Type', 'Item', '>Qty', 'Date'], d.recent.map((x) => `<tr><td>${txPill(x.type)}</td><td class="item-name"><b>${esc(x.item?.name)}</b><span>${esc(x.performedByName)}</span></td><td class="right"><b>${x.delta > 0 ? '+' : ''}${num(x.delta)}</b></td><td class="nowrap">${fmtDate(x.date)}</td></tr>`), 'No transactions recorded yet.')}</div>
  </div>`;
};
const txPill = (t) => ({ IN: pill('ok', 'Stock in'), OUT: pill('warn', 'Stock out'), ADJUST: pill('info', 'Adjustment') }[t]);

function chart(days) {
  const W = 640, H = 220, pl = 34, pb = 26, pt = 14, max = Math.max(5, ...days.flatMap((d) => [d.in, d.out]));
  const nice = Math.ceil(max / 5) * 5, ih = H - pb - pt, bw = 18, gw = (W - pl) / days.length;
  const y = (n) => pt + ih - (n / nice) * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) { const val = (nice / 4) * i; g += `<line x1="${pl}" x2="${W}" y1="${y(val)}" y2="${y(val)}" stroke="#e8edea"/><text x="${pl - 6}" y="${y(val) + 4}" text-anchor="end">${Math.round(val)}</text>`; }
  days.forEach((d, i) => {
    const cx = pl + gw * i + gw / 2;
    const lbl = new Date(d.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
    g += `<rect x="${cx - bw - 2}" y="${y(d.in)}" width="${bw}" height="${ih + pt - y(d.in)}" rx="3" fill="#0d6b66"><title>${lbl}: received ${d.in}</title></rect>`;
    g += `<rect x="${cx + 2}" y="${y(d.out)}" width="${bw}" height="${ih + pt - y(d.out)}" rx="3" fill="#e0944a"><title>${lbl}: issued ${d.out}</title></rect>`;
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${lbl}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Stock received and issued per day">${g}</svg>`;
}

/* ---------------- Items ---------------- */
pages.items = async (v) => {
  const [cats] = await Promise.all([api('/categories')]);
  const canEdit = can('admin', 'pharmacist');
  v.innerHTML = `${pageHead('Items', 'Medicines and medical supplies with live stock levels', canEdit ? `<button class="btn" id="add">${icon('plus')} New item</button>` : '')}
  <div class="card"><div class="toolbar">
    <input class="grow" id="q" placeholder="Search by name, generic name or code…" />
    <select id="ftype"><option value="">All types</option><option value="medicine">Medicines</option><option value="supply">Supplies</option></select>
    <select id="fstat"><option value="">All stock levels</option><option value="ok">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select>
  </div><div id="list"></div></div>`;
  let timer;
  const load = async () => {
    const rows = await api('/items' + qs({ search: $('#q').value, type: $('#ftype').value, status: $('#fstat').value, all: canEdit ? '1' : '' }));
    $('#list').innerHTML = table(['Item', 'Type', 'Category', '>On hand', '>Reorder', 'Status', 'Next expiry', ''], rows.map((i) => `<tr>
      <td class="item-name"><b>${esc(i.name)}${i.active ? '' : ' ' + pill('gray', 'Inactive')}</b><span><span class="mono">${esc(i.code)}</span>${i.strength ? ' · ' + esc(i.strength) : ''}${i.dosageForm ? ' ' + esc(i.dosageForm) : ''}</span></td>
      <td>${typePill(i.type)}</td><td>${esc(i.category?.name)}</td>
      <td class="right nowrap"><b>${num(i.usable)}</b> <span class="muted">${esc(i.unit)}</span>${i.expired ? `<div class="small" style="color:var(--danger)">+${num(i.expired)} expired</div>` : ''}</td>
      <td class="right">${num(i.reorderLevel)}</td><td>${stockPill(i.stockStatus)}</td><td class="nowrap">${fmtDate(i.nextExpiry)}</td>
      <td class="right">${canEdit ? `<button class="btn ghost sm" data-edit="${i._id}">Edit</button>` : ''}</td></tr>`), 'No items match your filters.');
    $$('[data-edit]').forEach((b) => (b.onclick = () => itemForm(rows.find((r) => r._id === b.dataset.edit), cats, load)));
  };
  $('#q').oninput = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
  $('#ftype').onchange = $('#fstat').onchange = load;
  if (canEdit) $('#add').onclick = () => itemForm(null, cats, load);
  await load();
};

function itemForm(item, cats, done) {
  const t = item?.type || 'medicine';
  const body = `<div class="form-grid">
    ${field('Item code', `<input name="code" value="${esc(item?.code)}" placeholder="MED-009" required />`)}
    ${field('Type', `<select name="type" id="ftype2"><option value="medicine" ${t === 'medicine' ? 'selected' : ''}>Medicine</option><option value="supply" ${t === 'supply' ? 'selected' : ''}>Medical supply</option></select>`)}
    ${field('Name', `<input name="name" value="${esc(item?.name)}" required />`, 'full')}
    ${field('Generic name', `<input name="genericName" value="${esc(item?.genericName)}" />`)}
    ${field('Category', `<select name="category" id="catsel" required></select>`)}
    ${field('Dosage form', `<input name="dosageForm" value="${esc(item?.dosageForm)}" placeholder="Tablet, Syrup, Injection" />`)}
    ${field('Strength / size', `<input name="strength" value="${esc(item?.strength)}" placeholder="500 mg" />`)}
    ${field('Unit of measure', `<input name="unit" value="${esc(item?.unit)}" placeholder="box, vial, pcs" required />`)}
    ${field('Reorder level', `<input name="reorderLevel" type="number" min="0" value="${item?.reorderLevel ?? 0}" required />`)}
    ${item ? field('Status', `<select name="active"><option value="true" ${item.active ? 'selected' : ''}>Active</option><option value="false" ${!item.active ? 'selected' : ''}>Inactive</option></select>`, 'full') : ''}
  </div>`;
  const ov = modal(item ? 'Edit item' : 'New item', body, {
    wide: true,
    onSubmit: async (d, close) => {
      if (d.active !== undefined) d.active = d.active === 'true';
      d.reorderLevel = Number(d.reorderLevel);
      await api(item ? `/items/${item._id}` : '/items', { method: item ? 'PUT' : 'POST', body: d });
      close(); toast(item ? 'Item updated' : 'Item created', 'success'); done();
    },
  });
  const fillCats = () => { $('#catsel', ov).innerHTML = opts(cats.filter((c) => c.type === $('#ftype2', ov).value), '_id', 'name', item?.category?._id || item?.category); };
  $('#ftype2', ov).onchange = fillCats; fillCats();
}

/* ---------------- Stock operations ---------------- */
function stockPage(mode) {
  return async (v) => {
    const [items, suppliers] = await Promise.all([api('/items'), mode === 'in' ? api('/suppliers') : Promise.resolve([])]);
    const picker = itemPicker(items);
    const meta = {
      in: ['Receive Stock', 'Record medicines and supplies received from suppliers (Stock In)', 'Receive stock'],
      out: ['Issue Stock', 'Record stock released to wards, departments or patients (Stock Out). Earliest-expiry batches are used first; expired and unavailable stock is rejected.', 'Issue stock'],
      adjust: ['Stock Adjustments', 'Correct stock counts for damage, loss, disposal or count errors. A reason is required and the change is logged.', 'Save adjustment'],
    }[mode];
    const form = {
      in: `${field('Supplier', `<select name="supplierId"><option value="">— Select supplier —</option>${opts(suppliers, '_id', 'name')}</select>`)}
           ${field('Batch / lot no.', '<input name="batchNo" id="batchNo" placeholder="e.g. AMX-2601" />')}
           ${field('Expiration date', '<input name="expiryDate" id="expiry" type="date" />')}
           ${field('Quantity received', '<input name="quantity" type="number" min="1" step="1" required />')}
           ${field('Date received', `<input name="date" type="date" value="${todayStr()}" required />`)}
           ${field('Reference (PO / DR no.)', '<input name="reference" placeholder="PO-1001" />')}
           ${field('Unit cost (optional)', '<input name="unitCost" type="number" min="0" step="0.01" />')}`,
      out: `${field('Batch', '<select name="batchId" id="batchSel"><option value="">Automatic — earliest expiry first</option></select>')}
            ${field('Quantity to issue', '<input name="quantity" type="number" min="1" step="1" required />')}
            ${field('Date issued', `<input name="date" type="date" value="${todayStr()}" required />`)}
            ${field('Reference (request / Rx no.)', '<input name="reference" placeholder="RX-20263" required />')}
            ${field('Issued to / remarks', '<input name="reason" placeholder="Ward, department or patient" />', 'full')}`,
      adjust: `${field('Batch to adjust', '<select name="batchId" id="batchSel" required><option value="">— Select an item first —</option></select>')}
               ${field('New quantity (actual count)', '<input name="newQuantity" id="newQty" type="number" min="0" step="1" required />')}
               ${field('Reason (required)', '<textarea name="reason" placeholder="e.g. Damaged during storage, count correction, disposal of expired stock" required></textarea>', 'full')}
               ${field('Reference (optional)', '<input name="reference" />', 'full')}`,
    }[mode];

    v.innerHTML = `${pageHead(meta[0], meta[1])}
    <div class="stock-layout">
      <form class="card" id="sf"><div class="card-b">
        ${field('Item', picker.html)}
        <div class="form-grid">${form}</div>
        <button class="btn" type="submit">${meta[2]}</button>
      </div></form>
      <div class="card"><div class="card-h"><h3>Item stock snapshot</h3></div><div class="card-b" id="snap"><div class="muted">Select an item to see its current stock and batches.</div></div></div>
    </div>`;

    let cur = null, batches = [];
    const showSnap = async () => {
      cur = picker.resolve($('#pick').value);
      if (!cur) { $('#snap').innerHTML = '<div class="muted">Select an item to see its current stock and batches.</div>'; if ($('#batchSel')) $('#batchSel').innerHTML = mode === 'adjust' ? '<option value="">— Select an item first —</option>' : '<option value="">Automatic — earliest expiry first</option>'; return; }
      const fetched = await api(`/items/${cur._id}/batches`);
      if (!$('#snap') || picker.resolve($('#pick').value) !== cur) return; // page changed or selection changed while loading
      batches = fetched;
      if ($('#expiry')) $('#expiry').required = cur.type === 'medicine';
      if ($('#batchNo')) $('#batchNo').required = cur.type === 'medicine';
      if ($('#batchNo')) $('#batchNo').placeholder = cur.type === 'medicine' ? 'e.g. AMX-2601' : 'Optional for supplies';
      $('#snap').innerHTML = `<div class="snap"><div><div class="lbl">Usable stock</div><div class="snap-num">${num(cur.usable)} <span class="small muted">${esc(cur.unit)}</span></div></div>
        <div><div class="lbl">Reorder level</div><div class="snap-num">${num(cur.reorderLevel)}</div></div><div><div class="lbl">Status</div><div style="margin-top:8px">${stockPill(cur.stockStatus)}</div></div></div>
        ${table(['Batch', '>Qty', 'Expiry'], batches.map((b) => `<tr class="${b.expired ? 'row-bad' : ''}"><td class="mono">${esc(b.batchNo)}</td><td class="right">${num(b.quantity)}</td><td>${fmtDate(b.expiryDate)} ${b.expired ? pill('danger', 'Expired') : ''}</td></tr>`), 'No stock on hand for this item.')}`;
      const sel = $('#batchSel');
      if (sel) {
        const usable = mode === 'out' ? batches.filter((b) => !b.expired) : batches;
        sel.innerHTML = (mode === 'out' ? '<option value="">Automatic — earliest expiry first</option>' : '<option value="">— Select batch —</option>') +
          usable.map((b) => `<option value="${b._id}" data-q="${b.quantity}">${esc(b.batchNo)} · qty ${b.quantity} · exp ${fmtDate(b.expiryDate)}</option>`).join('');
      }
    };
    $('#pick').addEventListener('input', showSnap); $('#pick').addEventListener('change', showSnap);
    if (mode === 'adjust') $('#batchSel').onchange = (e) => { const o = e.target.selectedOptions[0]; $('#newQty').value = o?.dataset.q ?? ''; };

    $('#sf').onsubmit = async (e) => {
      e.preventDefault();
      if (!cur) return toast('Please choose an item from the list', 'error');
      const btn = $('button[type=submit]', e.target); btn.disabled = true;
      const d = Object.fromEntries(new FormData(e.target).entries()); delete d.undefined; d.itemId = cur._id;
      try {
        const r = await api('/stock/' + mode, { method: 'POST', body: d });
        const refs = (Array.isArray(r) ? r : [r]).map((x) => x.refNo).join(', ');
        toast(`${meta[2]} — saved (${refs})`, 'success');
        e.target.reset(); $('#pick').value = ''; await showSnap();
        $$('input[name=date]', e.target).forEach((i) => (i.value = todayStr()));
      } catch (err) { toast(err.message, 'error'); }
      btn.disabled = false;
    };
  };
}
pages['stock-in'] = stockPage('in');
pages['stock-out'] = stockPage('out');
pages.adjust = stockPage('adjust');

/* ---------------- Batches & expiry ---------------- */
pages.batches = async (v) => {
  v.innerHTML = `${pageHead('Batches & Expiry', 'Every batch with remaining stock, sorted by earliest expiration')}
  <div class="card"><div class="toolbar"><div class="seg" id="seg">
    <button data-s="" class="on">All</button><button data-s="expired">Expired</button><button data-s="near">Near expiry</button><button data-s="ok">Good</button></div></div><div id="list"></div></div>`;
  const load = async (s = '') => {
    const rows = await api('/batches' + qs({ status: s }));
    $('#list').innerHTML = table(['Item', 'Batch', '>Quantity', 'Supplier', 'Received', 'Expiration', 'Status'], rows.map((b) => `<tr class="${b.expiryStatus === 'expired' ? 'row-bad' : b.expiryStatus === 'near' ? 'row-warn' : ''}">
      <td class="item-name"><b>${esc(b.item?.name)}</b><span class="mono">${esc(b.item?.code)}</span></td><td class="mono">${esc(b.batchNo)}</td>
      <td class="right"><b>${num(b.quantity)}</b> <span class="muted">${esc(b.item?.unit)}</span></td><td>${esc(b.supplier?.name || '—')}</td>
      <td class="nowrap">${fmtDate(b.receivedDate)}</td><td class="nowrap">${fmtDate(b.expiryDate)}</td><td>${expiryPill(b.expiryStatus, b.daysLeft)}</td></tr>`), 'No batches in this view.');
  };
  $('#seg').onclick = (e) => { if (!e.target.dataset) return; $$('#seg button').forEach((b) => b.classList.toggle('on', b === e.target)); load(e.target.dataset.s); };
  await load();
};

/* ---------------- Transactions ---------------- */
pages.transactions = async (v) => {
  v.innerHTML = `${pageHead('Transactions', 'Complete, tamper-proof inventory history')}
  <div class="card"><div class="toolbar">
    <select id="t"><option value="">All types</option><option value="IN">Stock in</option><option value="OUT">Stock out</option><option value="ADJUST">Adjustments</option></select>
    <label style="margin:0">From</label><input type="date" id="from" /><label style="margin:0">To</label><input type="date" id="to" />
  </div><div id="list"></div></div>`;
  const load = async () => {
    const rows = await api('/transactions' + qs({ type: $('#t').value, from: $('#from').value, to: $('#to').value }));
    $('#list').innerHTML = table(['Ref no.', 'Date', 'Type', 'Item', 'Batch', '>Change', '>Balance', 'Reference / reason', 'By'], rows.map((x) => `<tr>
      <td class="mono nowrap">${esc(x.refNo)}</td><td class="nowrap">${fmtDate(x.date)}</td><td>${txPill(x.type)}</td>
      <td class="item-name"><b>${esc(x.item?.name)}</b><span class="mono">${esc(x.item?.code)}</span></td><td class="mono">${esc(x.batchNo)}</td>
      <td class="right"><b style="color:${x.delta > 0 ? 'var(--ok)' : 'var(--warn)'}">${x.delta > 0 ? '+' : ''}${num(x.delta)}</b></td><td class="right">${num(x.balanceAfter)}</td>
      <td>${esc([x.reference, x.reason, x.supplier?.name].filter(Boolean).join(' · ') || '—')}</td><td class="nowrap">${esc(x.performedByName)}</td></tr>`), 'No transactions found.');
  };
  $$('#t, #from, #to').forEach((e) => (e.onchange = load));
  await load();
};

/* ---------------- Suppliers & Categories ---------------- */
pages.suppliers = async (v) => {
  const canEdit = can('admin', 'pharmacist');
  const load = async () => {
    const rows = await api('/suppliers');
    $('#list').innerHTML = table(['Supplier', 'Contact person', 'Phone', 'Email', 'Address', ''], rows.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.contactPerson)}</td><td>${esc(s.phone)}</td><td>${esc(s.email)}</td><td>${esc(s.address)}</td>
      <td class="right nowrap">${canEdit ? `<button class="btn ghost sm" data-e="${s._id}">Edit</button> <button class="btn ghost sm" data-d="${s._id}">Delete</button>` : ''}</td></tr>`), 'No suppliers yet.');
    $$('[data-e]').forEach((b) => (b.onclick = () => supplierForm(rows.find((r) => r._id === b.dataset.e), load)));
    $$('[data-d]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete this supplier?')) return; try { await api('/suppliers/' + b.dataset.d, { method: 'DELETE' }); toast('Supplier deleted', 'success'); load(); } catch (e) { toast(e.message, 'error'); } }));
  };
  v.innerHTML = `${pageHead('Suppliers', 'Vendors that deliver medicines and supplies', canEdit ? `<button class="btn" id="add">${icon('plus')} New supplier</button>` : '')}<div class="card" id="list"></div>`;
  if (canEdit) $('#add').onclick = () => supplierForm(null, load);
  await load();
};
function supplierForm(s, done) {
  modal(s ? 'Edit supplier' : 'New supplier',
    `<div class="form-grid">${field('Supplier name', `<input name="name" value="${esc(s?.name)}" required />`, 'full')}${field('Contact person', `<input name="contactPerson" value="${esc(s?.contactPerson)}" />`)}${field('Phone', `<input name="phone" value="${esc(s?.phone)}" />`)}${field('Email', `<input name="email" type="email" value="${esc(s?.email)}" />`, 'full')}${field('Address', `<input name="address" value="${esc(s?.address)}" />`, 'full')}</div>`,
    { onSubmit: async (d, close) => { await api(s ? '/suppliers/' + s._id : '/suppliers', { method: s ? 'PUT' : 'POST', body: d }); close(); toast('Supplier saved', 'success'); done(); } });
}

pages.categories = async (v) => {
  const canEdit = can('admin', 'pharmacist');
  const load = async () => {
    const rows = await api('/categories');
    $('#list').innerHTML = table(['Category', 'Type', 'Description', ''], rows.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td>${typePill(c.type)}</td><td>${esc(c.description)}</td>
      <td class="right nowrap">${canEdit ? `<button class="btn ghost sm" data-e="${c._id}">Edit</button> <button class="btn ghost sm" data-d="${c._id}">Delete</button>` : ''}</td></tr>`), 'No categories yet.');
    $$('[data-e]').forEach((b) => (b.onclick = () => categoryForm(rows.find((r) => r._id === b.dataset.e), load)));
    $$('[data-d]').forEach((b) => (b.onclick = async () => { if (!confirm('Delete this category?')) return; try { await api('/categories/' + b.dataset.d, { method: 'DELETE' }); toast('Category deleted', 'success'); load(); } catch (e) { toast(e.message, 'error'); } }));
  };
  v.innerHTML = `${pageHead('Categories', 'Group medicines and supplies', canEdit ? `<button class="btn" id="add">${icon('plus')} New category</button>` : '')}<div class="card" id="list"></div>`;
  if (canEdit) $('#add').onclick = () => categoryForm(null, load);
  await load();
};
function categoryForm(c, done) {
  modal(c ? 'Edit category' : 'New category',
    `${field('Name', `<input name="name" value="${esc(c?.name)}" required />`)}${field('Applies to', `<select name="type"><option value="medicine" ${c?.type === 'medicine' ? 'selected' : ''}>Medicines</option><option value="supply" ${c?.type === 'supply' ? 'selected' : ''}>Medical supplies</option></select>`)}${field('Description', `<input name="description" value="${esc(c?.description)}" />`)}`,
    { onSubmit: async (d, close) => { await api(c ? '/categories/' + c._id : '/categories', { method: c ? 'PUT' : 'POST', body: d }); close(); toast('Category saved', 'success'); done(); } });
}

/* ---------------- Reports (print / CSV) ---------------- */
const REPORTS = {
  stock: { title: 'Stock Level Report', load: () => api('/reports/stock'),
    cols: [['Code', (r) => r.code], ['Item', (r) => r.name + (r.strength ? ' ' + r.strength : '')], ['Type', (r) => r.type], ['Category', (r) => r.category?.name], ['Unit', (r) => r.unit], ['On hand', (r) => r.onHand, 'r'], ['Expired', (r) => r.expired, 'r'], ['Usable', (r) => r.usable, 'r'], ['Reorder level', (r) => r.reorderLevel, 'r'], ['Status', (r) => ({ ok: 'In stock', low: 'Low stock', out: 'Out of stock' }[r.stockStatus])]],
    cls: (r) => (r.stockStatus === 'out' ? 'row-bad' : r.stockStatus === 'low' ? 'row-warn' : '') },
  low: { title: 'Low Stock / Reorder Report', load: () => api('/reports/low-stock'),
    cols: [['Code', (r) => r.code], ['Item', (r) => r.name + (r.strength ? ' ' + r.strength : '')], ['Category', (r) => r.category?.name], ['Unit', (r) => r.unit], ['Usable', (r) => r.usable, 'r'], ['Reorder level', (r) => r.reorderLevel, 'r'], ['Suggested order', (r) => Math.max(r.reorderLevel * 2 - r.usable, 0), 'r'], ['Status', (r) => (r.stockStatus === 'out' ? 'Out of stock' : 'Low stock')]],
    cls: (r) => (r.stockStatus === 'out' ? 'row-bad' : 'row-warn') },
  expiry: { title: 'Expiry Report (expired & near-expiry)', load: () => api('/reports/expiry'),
    cols: [['Code', (r) => r.item?.code], ['Item', (r) => r.item?.name], ['Batch', (r) => r.batchNo], ['Quantity', (r) => r.quantity, 'r'], ['Unit', (r) => r.item?.unit], ['Supplier', (r) => r.supplier?.name || ''], ['Expiration', (r) => fmtDate(r.expiryDate)], ['Days left', (r) => r.daysLeft, 'r'], ['Status', (r) => (r.expiryStatus === 'expired' ? 'EXPIRED' : 'Near expiry')]],
    cls: (r) => (r.expiryStatus === 'expired' ? 'row-bad' : 'row-warn') },
  movements: { title: 'Inventory Movement Report', range: true, load: (f) => api('/reports/movements' + qs(f)),
    cols: [['Date', (r) => fmtDate(r.date)], ['Ref no.', (r) => r.refNo], ['Type', (r) => ({ IN: 'Stock in', OUT: 'Stock out', ADJUST: 'Adjustment' }[r.type])], ['Code', (r) => r.item?.code], ['Item', (r) => r.item?.name], ['Batch', (r) => r.batchNo], ['Change', (r) => r.delta, 'r'], ['Balance', (r) => r.balanceAfter, 'r'], ['Reference / reason', (r) => [r.reference, r.reason].filter(Boolean).join(' · ')], ['By', (r) => r.performedByName]],
    cls: () => '' },
};

pages.reports = async (v) => {
  let key = (location.hash.split('?')[1] || '').replace('r=', '') || 'stock';
  if (!REPORTS[key]) key = 'stock';
  let rows = [];
  v.innerHTML = `${pageHead('Reports', 'Generate, print or export inventory reports')}
  <div class="no-print" style="margin-bottom:14px"><div class="seg" id="seg">${Object.entries(REPORTS).map(([k, r]) => `<button data-k="${k}" class="${k === key ? 'on' : ''}">${esc(r.title.split(' (')[0].replace(' Report', ''))}</button>`).join('')}</div></div>
  <div class="card report-sheet"><div class="toolbar no-print" id="rtools"></div><div class="report-head" id="rhead"></div><div id="rbody"></div></div>`;
  const render = async () => {
    const R = REPORTS[key];
    $('#rtools').innerHTML = `${R.range ? `<label style="margin:0">From</label><input type="date" id="rf" /><label style="margin:0">To</label><input type="date" id="rt" /><select id="rtype"><option value="">All types</option><option value="IN">Stock in</option><option value="OUT">Stock out</option><option value="ADJUST">Adjustments</option></select>` : ''}
      <button class="btn ghost sm sp" id="csv">${icon('download')} CSV</button><button class="btn sm" id="prt">${icon('print')} Print</button>`;
    const filt = () => (R.range ? { from: $('#rf').value, to: $('#rt').value, type: $('#rtype').value } : {});
    const draw = async () => {
      rows = await R.load(filt());
      const f = filt();
      $('#rhead').innerHTML = `<h2>${esc(state.hospital)}</h2><p><b>Pharmacy &amp; Medical Inventory — ${esc(R.title)}</b></p><p>${f.from || f.to ? `Period: ${esc(f.from || 'start')} to ${esc(f.to || 'today')} · ` : ''}Generated ${new Date().toLocaleString('en-GB')} by ${esc(state.user.fullName)}</p>`;
      $('#rbody').innerHTML = table(R.cols.map((c) => (c[2] === 'r' ? '>' : '') + c[0]), rows.map((r) => `<tr class="${R.cls(r)}">${R.cols.map((c) => `<td class="${c[2] === 'r' ? 'right' : ''}">${esc(c[1](r) ?? '')}</td>`).join('')}</tr>`), 'No records for this report.');
    };
    if (R.range) $$('#rf,#rt,#rtype').forEach((e) => (e.onchange = draw));
    $('#prt').onclick = () => window.print();
    $('#csv').onclick = () => {
      const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
      const csv = [R.cols.map((c) => q(c[0])).join(','), ...rows.map((r) => R.cols.map((c) => q(c[1](r))).join(','))].join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = `${key}-report-${todayStr()}.csv`; a.click();
    };
    await draw();
  };
  $('#seg').onclick = (e) => { if (!e.target.dataset.k) return; key = e.target.dataset.k; $$('#seg button').forEach((b) => b.classList.toggle('on', b === e.target)); render(); };
  await render();
};

/* ---------------- Users (admin) ---------------- */
pages.users = async (v) => {
  const load = async () => {
    const rows = await api('/users');
    $('#list').innerHTML = table(['Name', 'Username', 'Role', 'Status', 'Created', ''], rows.map((u) => `<tr><td><b>${esc(u.fullName)}</b></td><td class="mono">${esc(u.username)}</td><td>${pill(u.role === 'admin' ? 'danger' : u.role === 'pharmacist' ? 'info' : 'gray', roleLabel[u.role])}</td>
      <td>${u.active ? pill('ok', 'Active') : pill('gray', 'Disabled')}</td><td>${fmtDate(u.createdAt)}</td><td class="right"><button class="btn ghost sm" data-e="${u._id}">Edit</button></td></tr>`));
    $$('[data-e]').forEach((b) => (b.onclick = () => userForm(rows.find((r) => r._id === b.dataset.e), load)));
  };
  v.innerHTML = `${pageHead('Users & Roles', 'Administrator: full access · Pharmacist: manage stock and records · Staff: view and issue stock', `<button class="btn" id="add">${icon('plus')} New user</button>`)}<div class="card" id="list"></div>`;
  $('#add').onclick = () => userForm(null, load);
  await load();
};
function userForm(u, done) {
  modal(u ? 'Edit user' : 'New user',
    `<div class="form-grid">${field('Full name', `<input name="fullName" value="${esc(u?.fullName)}" required />`, 'full')}
    ${u ? '' : field('Username', '<input name="username" required />')}
    ${field('Role', `<select name="role">${['admin', 'pharmacist', 'staff'].map((r) => `<option value="${r}" ${u?.role === r ? 'selected' : ''}>${roleLabel[r]}</option>`).join('')}</select>`)}
    ${field(u ? 'New password (leave blank to keep)' : 'Password', `<input name="password" type="password" minlength="6" ${u ? '' : 'required'} />`)}
    ${u ? field('Status', `<select name="active"><option value="true" ${u.active ? 'selected' : ''}>Active</option><option value="false" ${!u.active ? 'selected' : ''}>Disabled</option></select>`) : ''}</div>`,
    { onSubmit: async (d, close) => { if (d.active !== undefined) d.active = d.active === 'true'; if (!d.password) delete d.password; await api(u ? '/users/' + u._id : '/users', { method: u ? 'PUT' : 'POST', body: d }); close(); toast('User saved', 'success'); done(); } });
}

/* ---------------- Boot ---------------- */
(async () => {
  try { state.hospital = (await api('/config')).hospitalName; } catch (e) { /* server offline */ }
  if (localStorage.getItem('pmis_token')) {
    try { state.user = (await api('/auth/me')).user; renderShell(); return; } catch (e) { /* fall through to login */ }
  }
  renderLogin();
})();

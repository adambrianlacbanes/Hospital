// Dates are handled at UTC-midnight so "expires 2027-03-31" is stable in any timezone.
function today() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}
function parseDateOnly(value) {
  if (!value) return null;
  const d = new Date(String(value).length === 10 ? `${value}T00:00:00.000Z` : value);
  if (isNaN(d)) throw httpError(400, `Invalid date: ${value}`);
  return d;
}
function nearExpiryDays() {
  return parseInt(process.env.NEAR_EXPIRY_DAYS, 10) || 90;
}
function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
module.exports = { today, addDays, parseDateOnly, nearExpiryDays, httpError };

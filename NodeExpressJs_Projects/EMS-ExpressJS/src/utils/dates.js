const env = require('../config/env');

const pad = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD for a Date in the configured business timezone. */
function localDate(d = new Date(), tz = env.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return parts; // en-CA => YYYY-MM-DD
}

/** Date -> 'YYYY-MM-DD HH:mm:ss' in UTC (what DATETIME columns hold). */
function toSqlUtc(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
/** 'YYYY-MM-DD HH:mm:ss' (UTC) -> ISO string. */
const fromSqlUtc = (s) => (s ? `${s.replace(' ', 'T')}Z` : null);

const parseDate = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = parseDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const dayOfWeek = (s) => parseDate(s).getUTCDay();
const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

function eachDate(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
function monthRange(year, month) {
  const start = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end: `${year}-${pad(month)}-${pad(last)}` };
}

module.exports = { localDate, toSqlUtc, fromSqlUtc, addDays, dayOfWeek, diffDays, eachDate, monthRange, parseDate };

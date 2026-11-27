const { query } = require('../config/database');

const MAP = 'id, holiday_date AS holidayDate, name, location, is_optional AS isOptional';
const norm = (r) => ({ ...r, isOptional: !!r.isOptional });

async function list({ from, to, location }) {
  const w = []; const p = [];
  if (from) { w.push('holiday_date >= ?'); p.push(from); }
  if (to) { w.push('holiday_date <= ?'); p.push(to); }
  if (location) { w.push("(location = 'ALL' OR location = ?)"); p.push(location); }
  return (await query(`SELECT ${MAP} FROM holidays ${w.length ? `WHERE ${w.join(' AND ')}` : ''} ORDER BY holiday_date, location`, p)).map(norm);
}
const findById = async (id) => { const r = (await query(`SELECT ${MAP} FROM holidays WHERE id = ?`, [id]))[0]; return r && norm(r); };
const insert = async (h) => (await query('INSERT INTO holidays (holiday_date, name, location, is_optional) VALUES (?,?,?,?)', [h.holidayDate, h.name, h.location || 'ALL', h.isOptional ? 1 : 0])).insertId;
async function update(id, h) {
  const m = { holidayDate: 'holiday_date', name: 'name', location: 'location', isOptional: 'is_optional' };
  const k = Object.keys(m).filter((x) => h[x] !== undefined);
  if (k.length) await query(`UPDATE holidays SET ${k.map((x) => `${m[x]} = ?`).join(', ')} WHERE id = ?`, [...k.map((x) => (x === 'isOptional' ? (h[x] ? 1 : 0) : h[x])), id]);
}
const remove = async (id) => (await query('DELETE FROM holidays WHERE id = ?', [id])).affectedRows;

const weeklyOffs = (location, conn) => query("SELECT day_of_week AS dayOfWeek, location FROM weekly_offs WHERE location IN ('ALL', ?) ORDER BY location, day_of_week", [location || 'ALL'], conn);
const listWeeklyOffs = () => query('SELECT id, location, day_of_week AS dayOfWeek FROM weekly_offs ORDER BY location, day_of_week');
async function replaceWeeklyOffs(location, days) {
  const { withTransaction } = require('../config/database');
  await withTransaction(async (conn) => {
    await query('DELETE FROM weekly_offs WHERE location = ?', [location], conn);
    for (const d of days) await query('INSERT INTO weekly_offs (location, day_of_week) VALUES (?, ?)', [location, d], conn);
  });
}
/** Effective weekly-off days for a location: location-specific rows override 'ALL'. */
async function effectiveWeeklyOffDays(location, conn) {
  const rows = await weeklyOffs(location, conn);
  const specific = rows.filter((r) => r.location === location && location !== 'ALL');
  return (specific.length ? specific : rows.filter((r) => r.location === 'ALL')).map((r) => r.dayOfWeek);
}
const holidayDates = async (from, to, location, conn) =>
  new Set((await query("SELECT holiday_date AS d FROM holidays WHERE holiday_date BETWEEN ? AND ? AND is_optional = 0 AND (location = 'ALL' OR location = ?)", [from, to, location], conn)).map((r) => r.d));

module.exports = { list, findById, insert, update, remove, listWeeklyOffs, replaceWeeklyOffs, effectiveWeeklyOffDays, holidayDates };

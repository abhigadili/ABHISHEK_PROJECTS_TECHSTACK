const { query } = require('../config/database');
const { fromSqlUtc } = require('../utils/dates');

const SEL = `SELECT a.*, e.employee_code, CONCAT(e.first_name,' ',e.last_name) AS employee_name, e.department_id, d.name AS department_name
  FROM attendance a JOIN employees e ON e.id = a.employee_id LEFT JOIN departments d ON d.id = e.department_id`;

const toDto = (r) => r && ({
  id: r.id, employeeId: r.employee_id, employeeCode: r.employee_code, employeeName: r.employee_name,
  department: r.department_id ? { id: r.department_id, name: r.department_name } : null,
  workDate: r.work_date, checkInAt: fromSqlUtc(r.check_in_at), checkOutAt: fromSqlUtc(r.check_out_at),
  workingHours: r.working_hours === null ? null : Number(r.working_hours), status: r.status, workMode: r.work_mode, remarks: r.remarks,
  correction: r.corrected_at ? { correctedBy: r.corrected_by, correctedAt: fromSqlUtc(r.corrected_at), reason: r.correction_reason } : null,
});

const findById = async (id, conn) => toDto((await query(`${SEL} WHERE a.id = ?`, [id], conn))[0]);
const findByEmployeeDate = async (employeeId, date, conn) =>
  (await query(`SELECT * FROM attendance WHERE employee_id = ? AND work_date = ?${conn ? ' FOR UPDATE' : ''}`, [employeeId, date], conn))[0];

const insert = async (c, conn) => (await query(
  'INSERT INTO attendance (employee_id, work_date, check_in_at, check_out_at, working_hours, status, work_mode, remarks) VALUES (?,?,?,?,?,?,?,?)',
  [c.employeeId, c.workDate, c.checkInAt || null, c.checkOutAt || null, c.workingHours ?? null, c.status, c.workMode, c.remarks || null], conn)).insertId;

async function update(id, cols, conn) {
  const k = Object.keys(cols);
  if (k.length) await query(`UPDATE attendance SET ${k.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...k.map((c) => cols[c]), id], conn);
}

async function list({ employeeIds, from, to, status, departmentId, limit, offset, noPaging }) {
  const w = []; const p = [];
  if (employeeIds) { w.push('a.employee_id IN (?)'); p.push(employeeIds.length ? employeeIds : [0]); }
  if (from) { w.push('a.work_date >= ?'); p.push(from); }
  if (to) { w.push('a.work_date <= ?'); p.push(to); }
  if (status) { w.push('a.status = ?'); p.push(status); }
  if (departmentId) { w.push('e.department_id = ?'); p.push(departmentId); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM attendance a JOIN employees e ON e.id = a.employee_id ${where}`, p))[0].c;
  const rows = await query(`${SEL} ${where} ORDER BY a.work_date DESC, a.id DESC ${noPaging ? '' : 'LIMIT ? OFFSET ?'}`, noPaging ? p : [...p, limit, offset]);
  return { items: rows.map(toDto), total };
}

// ---- aggregates ----
async function summary({ employeeIds, from, to }) {
  const w = ['a.work_date BETWEEN ? AND ?']; const p = [from, to];
  if (employeeIds) { w.push('a.employee_id IN (?)'); p.push(employeeIds.length ? employeeIds : [0]); }
  const rows = await query(`SELECT a.status, COUNT(*) AS days, ROUND(COALESCE(SUM(a.working_hours),0),2) AS hours FROM attendance a WHERE ${w.join(' AND ')} GROUP BY a.status`, p);
  const out = { from, to, byStatus: {}, totalRecords: 0, totalHours: 0 };
  for (const r of rows) { out.byStatus[r.status] = Number(r.days); out.totalRecords += Number(r.days); out.totalHours += Number(r.hours); }
  out.totalHours = Math.round(out.totalHours * 100) / 100;
  return out;
}

const monthly = (from, to, employeeIds, departmentId) => {
  const w = []; const p = [from, to];
  if (employeeIds) { w.push('e.id IN (?)'); p.push(employeeIds.length ? employeeIds : [0]); }
  if (departmentId) { w.push('e.department_id = ?'); p.push(departmentId); }
  return query(
    `SELECT e.id AS employeeId, e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS employeeName, d.name AS department,
            COALESCE(SUM(a.status='PRESENT'),0) AS present, COALESCE(SUM(a.status='HALF_DAY'),0) AS halfDay, COALESCE(SUM(a.status='ABSENT'),0) AS absent,
            COALESCE(SUM(a.status='ON_LEAVE'),0) AS onLeave, COALESCE(SUM(a.status='HOLIDAY'),0) AS holiday, COALESCE(SUM(a.status='WEEKLY_OFF'),0) AS weeklyOff,
            ROUND(COALESCE(SUM(a.working_hours),0),2) AS totalHours
     FROM employees e LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date BETWEEN ? AND ?
     WHERE e.status = 'ACTIVE' ${w.length ? `AND ${w.join(' AND ')}` : ''}
     GROUP BY e.id, d.name ORDER BY e.employee_code`, p);
};

const byDepartment = (from, to) => query(
  `SELECT d.id AS departmentId, d.name AS department,
          (SELECT COUNT(*) FROM employees x WHERE x.department_id = d.id AND x.status = 'ACTIVE') AS headcount,
          COALESCE(SUM(a.status='PRESENT'),0) AS present, COALESCE(SUM(a.status='HALF_DAY'),0) AS halfDay, COALESCE(SUM(a.status='ABSENT'),0) AS absent,
          COALESCE(SUM(a.status='ON_LEAVE'),0) AS onLeave, ROUND(COALESCE(SUM(a.working_hours),0),2) AS totalHours,
          COUNT(DISTINCT a.work_date) AS daysWithRecords
   FROM departments d LEFT JOIN employees e ON e.department_id = d.id
   LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date BETWEEN ? AND ?
   WHERE d.is_active = 1 GROUP BY d.id, d.name ORDER BY d.name`, [from, to]);

module.exports = { findById, findByEmployeeDate, insert, update, list, summary, monthly, byDepartment };

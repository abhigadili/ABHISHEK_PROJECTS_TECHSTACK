const { query } = require('../config/database');

const SELECT = `
  SELECT e.*, d.name AS department_name, ds.name AS designation_name, t.name AS team_name,
         m.employee_code AS manager_code, CONCAT(m.first_name, ' ', m.last_name) AS manager_name,
         (pp.employee_id IS NOT NULL) AS has_picture, u.id AS user_id, r.name AS role
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN designations ds ON ds.id = e.designation_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN employees m ON m.id = e.manager_id
  LEFT JOIN employee_profile_pictures pp ON pp.employee_id = e.id
  LEFT JOIN users u ON u.employee_id = e.id
  LEFT JOIN roles r ON r.id = u.role_id`;

const SORTABLE = {
  name: 'e.last_name, e.first_name', employeeCode: 'e.employee_code', joiningDate: 'e.joining_date',
  department: 'd.name', designation: 'ds.name', status: 'e.status', createdAt: 'e.created_at',
};

const escLike = (s) => s.replace(/[\\%_]/g, '\\$&');

function buildFilters(f, scopeIds) {
  const where = []; const p = [];
  if (f.q) {
    const like = `%${escLike(f.q)}%`;
    where.push(`(e.first_name LIKE ? OR e.last_name LIKE ? OR CONCAT(e.first_name,' ',e.last_name) LIKE ? OR e.work_email LIKE ? OR e.employee_code LIKE ? OR e.job_title LIKE ?)`);
    p.push(like, like, like, like, like, like);
  }
  if (f.departmentId) { where.push('e.department_id = ?'); p.push(f.departmentId); }
  if (f.teamId) { where.push('e.team_id = ?'); p.push(f.teamId); }
  if (f.designationId) { where.push('e.designation_id = ?'); p.push(f.designationId); }
  if (f.managerId) { where.push('e.manager_id = ?'); p.push(f.managerId); }
  if (f.employmentType) { where.push('e.employment_type = ?'); p.push(f.employmentType); }
  if (f.location) { where.push('e.work_location = ?'); p.push(f.location); }
  if (f.status && f.status !== 'ALL') { where.push('e.status = ?'); p.push(f.status); }
  if (scopeIds) { where.push('e.id IN (?)'); p.push(scopeIds.length ? scopeIds : [0]); }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params: p };
}

async function search(filters, { orderBy, limit, offset }) {
  const { where, params } = buildFilters(filters);
  const total = (await query(`SELECT COUNT(*) AS c FROM employees e ${where}`, params))[0].c;
  const rows = await query(`${SELECT} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { rows, total };
}

const findById = async (id, conn) => (await query(`${SELECT} WHERE e.id = ?`, [id], conn))[0];
const findByCode = async (code) => (await query(`${SELECT} WHERE e.employee_code = ?`, [code]))[0];
const findBrief = async (id) => (await query(
  `SELECT e.id, e.employee_code AS employeeCode, e.first_name AS firstName, e.last_name AS lastName, e.work_email AS workEmail,
          e.status, e.department_id AS departmentId, e.manager_id AS managerId
   FROM employees e WHERE e.id = ?`, [id]))[0];

async function lockById(id, conn) {
  return (await query('SELECT * FROM employees WHERE id = ? FOR UPDATE', [id], conn))[0];
}

async function nextCode(conn) {
  const r = await query("SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code, 5) AS UNSIGNED)), 1000) + 1 AS n FROM employees WHERE employee_code REGEXP '^EMP-[0-9]+$'", [], conn);
  return `EMP-${r[0].n}`;
}

async function insert(cols, conn) {
  const keys = Object.keys(cols);
  const r = await query(`INSERT INTO employees (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, keys.map((k) => cols[k]), conn);
  return r.insertId;
}
async function update(id, cols, conn) {
  const keys = Object.keys(cols);
  if (!keys.length) return;
  await query(`UPDATE employees SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => cols[k]), id], conn);
}

const countActiveReports = async (id, conn) => (await query("SELECT COUNT(*) c FROM employees WHERE manager_id = ? AND status = 'ACTIVE'", [id], conn))[0].c;
const reassignReports = (from, to, conn) => query("UPDATE employees SET manager_id = ? WHERE manager_id = ? AND status = 'ACTIVE'", [to, from], conn);
const emailTaken = async (email, exceptId) =>
  (await query('SELECT id FROM employees WHERE work_email = ? AND id <> ?', [email, exceptId || 0]))[0];

// ---- job history ----
const insertHistory = (h, conn) => query(
  `INSERT INTO job_history (employee_id, change_type, effective_date, from_designation_id, to_designation_id, from_department_id, to_department_id,
     from_manager_id, to_manager_id, from_job_title, to_job_title, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [h.employeeId, h.changeType, h.effectiveDate, h.fromDesignationId ?? null, h.toDesignationId ?? null, h.fromDepartmentId ?? null, h.toDepartmentId ?? null,
    h.fromManagerId ?? null, h.toManagerId ?? null, h.fromJobTitle ?? null, h.toJobTitle ?? null, h.notes ?? null, h.createdBy ?? null], conn);

const listHistory = (employeeId) => query(
  `SELECT j.id, j.change_type AS changeType, j.effective_date AS effectiveDate, j.notes, j.created_at AS createdAt,
          j.from_job_title AS fromJobTitle, j.to_job_title AS toJobTitle,
          fd.name AS fromDesignation, td.name AS toDesignation, fdep.name AS fromDepartment, tdep.name AS toDepartment,
          CONCAT(fm.first_name,' ',fm.last_name) AS fromManager, CONCAT(tm.first_name,' ',tm.last_name) AS toManager
   FROM job_history j
   LEFT JOIN designations fd ON fd.id = j.from_designation_id LEFT JOIN designations td ON td.id = j.to_designation_id
   LEFT JOIN departments fdep ON fdep.id = j.from_department_id LEFT JOIN departments tdep ON tdep.id = j.to_department_id
   LEFT JOIN employees fm ON fm.id = j.from_manager_id LEFT JOIN employees tm ON tm.id = j.to_manager_id
   WHERE j.employee_id = ? ORDER BY j.effective_date DESC, j.id DESC`, [employeeId]);

// ---- pictures ----
const savePicture = (employeeId, mime, buf) => query(
  `INSERT INTO employee_profile_pictures (employee_id, mime_type, size_bytes, data) VALUES (?,?,?,?)
   ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), size_bytes = VALUES(size_bytes), data = VALUES(data)`, [employeeId, mime, buf.length, buf]);
const getPicture = async (employeeId) => (await query('SELECT mime_type, size_bytes, data FROM employee_profile_pictures WHERE employee_id = ?', [employeeId]))[0];
const deletePicture = async (employeeId) => (await query('DELETE FROM employee_profile_pictures WHERE employee_id = ?', [employeeId])).affectedRows;

module.exports = {
  SORTABLE, search, findById, findByCode, findBrief, lockById, nextCode, insert, update, countActiveReports, reassignReports,
  emailTaken, insertHistory, listHistory, savePicture, getPicture, deletePicture,
};

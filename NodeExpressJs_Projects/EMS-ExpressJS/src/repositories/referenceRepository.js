// Departments, teams and designations.
const { query } = require('../config/database');

const escLike = (s) => `%${s.replace(/[\\%_]/g, '\\$&')}%`;
const dyn = (cols) => { const k = Object.keys(cols); return { k, set: k.map((c) => `${c} = ?`).join(', '), v: k.map((c) => cols[c]) }; };

// ---------- departments ----------
const DEPT = `SELECT d.id, d.code, d.name, d.description, d.is_active AS isActive, d.head_employee_id AS headEmployeeId,
   CASE WHEN h.id IS NULL THEN NULL ELSE CONCAT(h.first_name,' ',h.last_name) END AS headName,
   (SELECT COUNT(*) FROM employees e WHERE e.department_id = d.id AND e.status = 'ACTIVE') AS headcount,
   d.created_at AS createdAt, d.updated_at AS updatedAt
   FROM departments d LEFT JOIN employees h ON h.id = d.head_employee_id`;
const norm = (r) => (r ? { ...r, isActive: !!r.isActive } : r);

async function listDepartments({ q, isActive, limit, offset }) {
  const w = []; const p = [];
  if (q) { w.push('(d.name LIKE ? OR d.code LIKE ?)'); p.push(escLike(q), escLike(q)); }
  if (isActive !== undefined) { w.push('d.is_active = ?'); p.push(isActive ? 1 : 0); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM departments d ${where}`, p))[0].c;
  const rows = await query(`${DEPT} ${where} ORDER BY d.name LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return { items: rows.map(norm), total };
}
const getDepartmentDetail = async (id) => norm((await query(`${DEPT} WHERE d.id = ?`, [id]))[0]);
const getDepartment = async (id, conn) => (await query('SELECT id, is_active, head_employee_id FROM departments WHERE id = ?', [id], conn))[0];
const insertDepartment = async (c) => (await query('INSERT INTO departments (code, name, description, head_employee_id) VALUES (?,?,?,?)', [c.code, c.name, c.description || null, c.headEmployeeId || null])).insertId;
async function updateDepartment(id, cols) { const d = dyn(cols); if (d.k.length) await query(`UPDATE departments SET ${d.set} WHERE id = ?`, [...d.v, id]); }
const deptActiveEmployees = async (id) => (await query("SELECT COUNT(*) c FROM employees WHERE department_id = ? AND status = 'ACTIVE'", [id]))[0].c;

// ---------- teams ----------
const TEAM = `SELECT t.id, t.name, t.description, t.department_id AS departmentId, d.name AS departmentName, t.lead_employee_id AS leadEmployeeId,
   t.is_active AS isActive, (SELECT COUNT(*) FROM employees e WHERE e.team_id = t.id AND e.status = 'ACTIVE') AS memberCount
   FROM teams t JOIN departments d ON d.id = t.department_id`;
async function listTeams({ q, departmentId, isActive, limit, offset }) {
  const w = []; const p = [];
  if (q) { w.push('t.name LIKE ?'); p.push(escLike(q)); }
  if (departmentId) { w.push('t.department_id = ?'); p.push(departmentId); }
  if (isActive !== undefined) { w.push('t.is_active = ?'); p.push(isActive ? 1 : 0); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM teams t ${where}`, p))[0].c;
  const rows = await query(`${TEAM} ${where} ORDER BY d.name, t.name LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return { items: rows.map(norm), total };
}
const getTeamDetail = async (id) => norm((await query(`${TEAM} WHERE t.id = ?`, [id]))[0]);
const getTeam = async (id, conn) => (await query('SELECT id, department_id, is_active FROM teams WHERE id = ?', [id], conn))[0];
const insertTeam = async (c) => (await query('INSERT INTO teams (department_id, name, description, lead_employee_id) VALUES (?,?,?,?)', [c.departmentId, c.name, c.description || null, c.leadEmployeeId || null])).insertId;
async function updateTeam(id, cols) { const d = dyn(cols); if (d.k.length) await query(`UPDATE teams SET ${d.set} WHERE id = ?`, [...d.v, id]); }
const teamMembers = (id) => query("SELECT id, employee_code AS employeeCode, CONCAT(first_name,' ',last_name) AS name, job_title AS jobTitle FROM employees WHERE team_id = ? AND status = 'ACTIVE' ORDER BY last_name", [id]);
const assignToTeam = (teamId, employeeIds, conn) => query("UPDATE employees SET team_id = ? WHERE id IN (?) AND status = 'ACTIVE'", [teamId, employeeIds], conn);
const employeesDepartment = (ids, conn) => query('SELECT id, department_id FROM employees WHERE id IN (?)', [ids], conn);

// ---------- designations ----------
const DES = `SELECT id, name, description, job_level AS jobLevel, is_active AS isActive,
   (SELECT COUNT(*) FROM employees e WHERE e.designation_id = designations.id AND e.status = 'ACTIVE') AS headcount FROM designations`;
async function listDesignations({ q, isActive, limit, offset }) {
  const w = []; const p = [];
  if (q) { w.push('name LIKE ?'); p.push(escLike(q)); }
  if (isActive !== undefined) { w.push('is_active = ?'); p.push(isActive ? 1 : 0); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) c FROM designations ${where}`, p))[0].c;
  const rows = await query(`${DES} ${where} ORDER BY job_level DESC, name LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return { items: rows.map(norm), total };
}
const getDesignationDetail = async (id) => norm((await query(`${DES} WHERE id = ?`, [id]))[0]);
const getDesignation = async (id, conn) => (await query('SELECT id, is_active FROM designations WHERE id = ?', [id], conn))[0];
const insertDesignation = async (c) => (await query('INSERT INTO designations (name, description, job_level) VALUES (?,?,?)', [c.name, c.description || null, c.jobLevel || 1])).insertId;
async function updateDesignation(id, cols) { const d = dyn(cols); if (d.k.length) await query(`UPDATE designations SET ${d.set} WHERE id = ?`, [...d.v, id]); }

module.exports = {
  listDepartments, getDepartmentDetail, getDepartment, insertDepartment, updateDepartment, deptActiveEmployees,
  listTeams, getTeamDetail, getTeam, insertTeam, updateTeam, teamMembers, assignToTeam, employeesDepartment,
  listDesignations, getDesignationDetail, getDesignation, insertDesignation, updateDesignation,
};

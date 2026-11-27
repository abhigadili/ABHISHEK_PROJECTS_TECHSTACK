const { query } = require('../config/database');

const inScope = (ids, col = 'e.id') => (ids ? { sql: `AND ${col} IN (?)`, params: [ids.length ? ids : [0]] } : { sql: '', params: [] });

async function employeeCounts(ids) {
  const s = inScope(ids);
  const r = (await query(`SELECT COUNT(*) total, SUM(status='ACTIVE') active, SUM(status<>'ACTIVE') inactive FROM employees e WHERE 1=1 ${s.sql}`, s.params))[0];
  return { total: Number(r.total), active: Number(r.active || 0), inactive: Number(r.inactive || 0) };
}
const headcountByDepartment = (ids) => {
  if (!ids) return query('SELECT department_id AS departmentId, name AS department, headcount FROM v_department_headcount WHERE is_active = 1 ORDER BY name');
  return query(`SELECT d.id AS departmentId, d.name AS department, COUNT(e.id) AS headcount FROM departments d
    JOIN employees e ON e.department_id = d.id AND e.status = 'ACTIVE' AND e.id IN (?) GROUP BY d.id, d.name ORDER BY d.name`, [ids.length ? ids : [0]]);
};
async function attendanceOn(date, ids) {
  const s = inScope(ids, 'a.employee_id');
  const rows = await query(`SELECT a.status, COUNT(*) c FROM attendance a WHERE a.work_date = ? ${s.sql} GROUP BY a.status`, [date, ...s.params]);
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.c)]));
}
async function onLeaveOn(date, ids) {
  const s = inScope(ids, 'r.employee_id');
  return Number((await query(`SELECT COUNT(DISTINCT r.employee_id) c FROM leave_requests r WHERE r.status = 'APPROVED' AND ? BETWEEN r.start_date AND r.end_date ${s.sql}`, [date, ...s.params]))[0].c);
}
async function leaveStatusCounts(year, ids) {
  const s = inScope(ids, 'r.employee_id');
  const rows = await query(`SELECT r.status, COUNT(*) c, COALESCE(SUM(r.days),0) days FROM leave_requests r WHERE YEAR(r.start_date) = ? ${s.sql} GROUP BY r.status`, [year, ...s.params]);
  return Object.fromEntries(rows.map((r) => [r.status, { requests: Number(r.c), days: Number(r.days) }]));
}
async function pendingApprovalCount(ids) {
  const s = inScope(ids, 'r.employee_id');
  return Number((await query(`SELECT COUNT(*) c FROM leave_requests r WHERE r.status = 'PENDING' ${s.sql}`, s.params))[0].c);
}

// Next occurrence of an annual date (month/day) on/after `today`. Derived table keeps the placeholder order obvious.
const nextOcc = (col) => `DATE(CONCAT(YEAR(?) + (DATE_FORMAT(${col}, '%m-%d') < DATE_FORMAT(?, '%m-%d')), '-', DATE_FORMAT(${col}, '%m-%d')))`;
async function birthdays(today, days, ids) {
  const s = inScope(ids);
  return query(`SELECT employeeId, employeeCode, name, next_date AS date FROM (
      SELECT e.id AS employeeId, e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS name, ${nextOcc('e.date_of_birth')} AS next_date
      FROM employees e WHERE e.status = 'ACTIVE' AND e.date_of_birth IS NOT NULL ${s.sql}) x
    WHERE next_date BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY) ORDER BY next_date, name`, [today, today, ...s.params, today, today, days]);
}
async function anniversaries(today, days, ids) {
  const s = inScope(ids);
  return query(`SELECT employeeId, employeeCode, name, next_date AS date, (YEAR(next_date) - YEAR(joining_date)) AS years FROM (
      SELECT e.id AS employeeId, e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS name, e.joining_date, ${nextOcc('e.joining_date')} AS next_date
      FROM employees e WHERE e.status = 'ACTIVE' ${s.sql}) x
    WHERE next_date BETWEEN ? AND DATE_ADD(?, INTERVAL ? DAY) AND YEAR(next_date) > YEAR(joining_date) ORDER BY next_date, name`, [today, today, ...s.params, today, today, days]);
}

const joiners = (from, to, ids) => { const s = inScope(ids); return query(
  `SELECT e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS name, d.name AS department, e.joining_date AS date, e.employment_type AS employmentType
   FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.joining_date BETWEEN ? AND ? ${s.sql} ORDER BY e.joining_date`, [from, to, ...s.params]); };
const exits = (from, to, ids) => { const s = inScope(ids); return query(
  `SELECT e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS name, d.name AS department, e.exit_date AS date, e.status
   FROM employees e LEFT JOIN departments d ON d.id = e.department_id WHERE e.exit_date BETWEEN ? AND ? ${s.sql} ORDER BY e.exit_date`, [from, to, ...s.params]); };

const leaveBalanceReport = (year, ids, departmentId) => {
  const s = inScope(ids); const dep = departmentId ? 'AND e.department_id = ?' : '';
  return query(`SELECT e.employee_code AS employeeCode, CONCAT(e.first_name,' ',e.last_name) AS name, d.name AS department, v.leave_type_code AS leaveType,
      v.entitled, v.adjusted, v.used, v.available
    FROM v_leave_balance_available v JOIN employees e ON e.id = v.employee_id LEFT JOIN departments d ON d.id = e.department_id
    WHERE v.year = ? ${s.sql} ${dep} ORDER BY e.employee_code, v.leave_type_id`, [year, ...s.params, ...(departmentId ? [departmentId] : [])]);
};
const leaveSummaryReport = (from, to, ids, departmentId) => {
  const s = inScope(ids); const dep = departmentId ? 'AND e.department_id = ?' : '';
  return query(`SELECT d.name AS department, lt.code AS leaveType, r.status, COUNT(*) requests, COALESCE(SUM(r.days),0) days
    FROM leave_requests r JOIN employees e ON e.id = r.employee_id LEFT JOIN departments d ON d.id = e.department_id JOIN leave_types lt ON lt.id = r.leave_type_id
    WHERE r.start_date <= ? AND r.end_date >= ? ${s.sql} ${dep} GROUP BY d.name, lt.code, r.status ORDER BY d.name, lt.code, r.status`, [to, from, ...s.params, ...(departmentId ? [departmentId] : [])]);
};
const departmentReport = () => query(
  `SELECT d.code, d.name, CONCAT(h.first_name,' ',h.last_name) AS head, d.is_active AS isActive,
     SUM(e.status='ACTIVE') AS activeEmployees, SUM(e.status<>'ACTIVE') AS inactiveEmployees,
     (SELECT COUNT(*) FROM teams t WHERE t.department_id = d.id AND t.is_active = 1) AS teams
   FROM departments d LEFT JOIN employees h ON h.id = d.head_employee_id LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id, h.id ORDER BY d.name`);
const designationReport = () => query(
  `SELECT ds.name, ds.job_level AS jobLevel, ds.is_active AS isActive, COALESCE(SUM(e.status='ACTIVE'),0) AS activeEmployees
   FROM designations ds LEFT JOIN employees e ON e.designation_id = ds.id GROUP BY ds.id ORDER BY ds.job_level DESC, ds.name`);

module.exports = {
  employeeCounts, headcountByDepartment, attendanceOn, onLeaveOn, leaveStatusCounts, pendingApprovalCount, birthdays, anniversaries,
  joiners, exits, leaveBalanceReport, leaveSummaryReport, departmentReport, designationReport,
};

const { query } = require('../config/database');

const BASE = `SELECT u.id, u.employee_id, u.username, u.email, u.password_hash, u.is_active, u.last_login_at,
                     r.name AS role, u.role_id
              FROM users u JOIN roles r ON r.id = u.role_id`;

const findAuthContext = async (id) => (await query(`${BASE} WHERE u.id = ?`, [id]))[0];
const findByEmail = async (email) => (await query(`${BASE} WHERE u.email = ?`, [email]))[0];
const findByUsername = async (username) => (await query(`${BASE} WHERE u.username = ?`, [username]))[0];
const findById = findAuthContext;
const findByEmployeeId = async (employeeId, conn) => (await query(`${BASE} WHERE u.employee_id = ?`, [employeeId], conn))[0];

async function create({ employeeId, email, passwordHash, roleId, username }, conn) {
  const r = await query(
    'INSERT INTO users (employee_id, username, email, password_hash, role_id, password_changed_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())',
    [employeeId || null, username || null, email, passwordHash, roleId],
    conn
  );
  return r.insertId;
}

const updatePassword = (id, passwordHash, conn) =>
  query('UPDATE users SET password_hash = ?, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [passwordHash, id], conn);

const touchLogin = (id) => query('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
const setActive = (id, active, conn) => query('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, id], conn);
const setActiveByEmployee = (employeeId, active, conn) => query('UPDATE users SET is_active = ? WHERE employee_id = ?', [active ? 1 : 0, employeeId], conn);
const updateRole = (id, roleId, conn) => query('UPDATE users SET role_id = ? WHERE id = ?', [roleId, id], conn);
const updateEmailByEmployee = (employeeId, email, conn) => query('UPDATE users SET email = ? WHERE employee_id = ?', [email, employeeId], conn);

async function userIdsByRoles(roleNames, conn) {
  const rows = await query(
    'SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 AND r.name IN (?)',
    [roleNames], conn);
  return rows.map((r) => r.id);
}
async function userIdsByEmployeeIds(employeeIds, conn) {
  if (!employeeIds.length) return [];
  const rows = await query('SELECT id FROM users WHERE is_active = 1 AND employee_id IN (?)', [employeeIds], conn);
  return rows.map((r) => r.id);
}
const countUsers = async () => (await query('SELECT COUNT(*) AS c FROM users'))[0].c;

module.exports = {
  findAuthContext, findByEmail, findByUsername, findById, findByEmployeeId, create, updatePassword, touchLogin, setActive,
  setActiveByEmployee, updateRole, updateEmailByEmployee, userIdsByRoles, userIdsByEmployeeIds, countUsers,
};

const request = require('supertest');
const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const db = require('../src/config/database');
const { createApp } = require('../src/app');

const PASSWORD = 'Str0ng-Passw0rd!';
const app = createApp();
const api = () => request(app);
const P = env.apiPrefix;

const TABLES = ['audit_logs', 'notifications', 'leave_balance_transactions', 'leave_request_documents', 'leave_requests', 'leave_balances', 'attendance',
  'job_history', 'password_reset_tokens', 'refresh_tokens', 'users', 'employee_profile_pictures', 'holidays'];

/** Empty all transactional data (test DB only), keep reference data (roles, leave types/policies, weekly offs). */
async function resetDb() {
  if (!/_test$/.test(env.db.name)) throw new Error('resetDb is restricted to *_test databases');
  const pool = db.getPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [...TABLES, 'teams', 'employees', 'designations', 'departments']) await pool.query(`TRUNCATE TABLE ${t}`);
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
}

let seq = 0;
/** Insert an employee (+ optional login) directly, bypassing the API. */
async function makeEmployee({ role, first = 'Test', last, managerId = null, departmentId = null, location = 'HQ', joining = '2024-01-02', salary = 50000, designationId = null } = {}) {
  seq += 1;
  const code = `T-${String(seq).padStart(4, '0')}`;
  const email = `user${seq}@test.example`;
  const [r] = await db.getPool().query(
    `INSERT INTO employees (employee_code, first_name, last_name, work_email, joining_date, manager_id, department_id, work_location, salary, salary_currency, designation_id, date_of_birth)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [code, first, last || `User${seq}`, email, joining, managerId, departmentId, location, salary, 'USD', designationId, '1990-06-15']);
  const out = { employeeId: r.insertId, code, email, password: PASSWORD };
  if (role) {
    const roleId = { SUPER_ADMIN: 1, HR_ADMIN: 2, MANAGER: 3, EMPLOYEE: 4 }[role];
    const [u] = await db.getPool().query('INSERT INTO users (employee_id, email, password_hash, role_id) VALUES (?,?,?,?)', [r.insertId, email, await bcrypt.hash(PASSWORD, 4), roleId]);
    out.userId = u.insertId;
  }
  return out;
}

async function login(email, password = PASSWORD) {
  const res = await api().post(`${P}/auth/login`).send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body.data, auth: { Authorization: `Bearer ${res.body.data.accessToken}` } };
}

/** Build a user and return a ready-to-use auth header. */
async function actor(role, opts = {}) {
  const e = await makeEmployee({ role, ...opts });
  const t = await login(e.email);
  return { ...e, ...t };
}

// tiny valid images (magic bytes + padding)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);

const nextWeekday = (offset = 7) => { // a Mon-Fri date `offset`+ days ahead (UTC)
  const d = new Date(); d.setUTCDate(d.getUTCDate() + offset);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

module.exports = { api, P, app, db, resetDb, makeEmployee, login, actor, PASSWORD, PNG, JPEG, nextWeekday };

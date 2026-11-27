#!/usr/bin/env node
/* Creates the initial SUPER_ADMIN (employee record + login). Credentials come from the environment, never from source:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
 * Refuses to run if a SUPER_ADMIN already exists (use /employees/:id/account + /role afterwards). The password is never printed. */
const env = require('../src/config/env');
const db = require('../src/config/database');
const pw = require('../src/utils/password');
const { ROLE_IDS } = require('../src/constants');
const { localDate } = require('../src/utils/dates');

async function main() {
  env.assertConfigured();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('ADMIN_EMAIL is missing or invalid');
  if (!pw.isStrong(password)) throw new Error(`ADMIN_PASSWORD rejected: ${pw.POLICY_MESSAGE}`);
  const existing = await db.query("SELECT COUNT(*) c FROM users WHERE role_id = ?", [ROLE_IDS.SUPER_ADMIN]);
  if (existing[0].c > 0) throw new Error('A SUPER_ADMIN already exists; refusing to create another');
  const hash = await pw.hash(password);
  await db.withTransaction(async (conn) => {
    const [r] = await conn.query(
      "INSERT INTO employees (employee_code, first_name, last_name, work_email, joining_date, status, employment_type, job_title, work_location) VALUES ('EMP-0001', ?, ?, ?, ?, 'ACTIVE', 'FULL_TIME', 'System Administrator', 'HQ')",
      [process.env.ADMIN_FIRST_NAME || 'System', process.env.ADMIN_LAST_NAME || 'Administrator', email, localDate()]);
    await conn.query('INSERT INTO users (employee_id, email, password_hash, role_id, password_changed_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [r.insertId, email, hash, ROLE_IDS.SUPER_ADMIN]);
  });
  console.log(`SUPER_ADMIN created for ${email}`);
}
main().catch((e) => { console.error('admin:create failed:', e.message); process.exitCode = 1; }).finally(() => db.close());

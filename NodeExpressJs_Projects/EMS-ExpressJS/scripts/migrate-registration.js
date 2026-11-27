#!/usr/bin/env node
/* Idempotent migration for databases created BEFORE self-registration existed (fresh databases get these columns from 02_create_tables.sql).
 *   adds users.username (nullable, unique)  and  employees.gender
 * Usage: npm run db:migrate       (uses the credentials in .env; safe to run repeatedly) */
const env = require('../src/config/env');
const db = require('../src/config/database');

async function has(table, column) {
  const r = await db.query('SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [table, column]);
  return r[0].c > 0;
}
async function hasIndex(table, index) {
  const r = await db.query('SELECT COUNT(*) c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?', [table, index]);
  return r[0].c > 0;
}
async function main() {
  env.assertConfigured();
  if (!(await has('users', 'username'))) { await db.query('ALTER TABLE users ADD COLUMN username VARCHAR(30) NULL AFTER employee_id'); console.log('added users.username'); }
  if (!(await hasIndex('users', 'uq_users_username'))) { await db.query('ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)'); console.log('added unique index uq_users_username'); }
  if (!(await has('employees', 'gender'))) { await db.query("ALTER TABLE employees ADD COLUMN gender ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') NULL AFTER date_of_birth"); console.log('added employees.gender'); }
  console.log(`migration complete for ${env.db.name}`);
}
main().catch((e) => { console.error('migration failed:', e.message); process.exitCode = 1; }).finally(() => db.close());

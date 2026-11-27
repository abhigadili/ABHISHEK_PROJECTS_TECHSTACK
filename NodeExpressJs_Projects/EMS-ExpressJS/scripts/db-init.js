#!/usr/bin/env node
/* Runs the ordered SQL scripts against the configured database using the credentials in .env.
 * Usage: npm run db:init [-- --no-sample]      (refuses to run if the schema already exists) */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

const FILES = ['02_create_tables.sql', '03_create_indexes_and_constraints.sql', '04_create_views.sql', '07_seed_reference_data.sql', '08_seed_sample_employees.sql'];

async function runScripts(conn, dbName, files) {
  for (const f of files) {
    const sql = fs.readFileSync(path.join(__dirname, '../sql-scripts', f), 'utf8').replace(/^USE\s+\w+;/im, `USE \`${dbName}\`;`);
    await conn.query(sql);
    console.log(`  ok  ${f}`);
  }
}

async function main() {
  env.assertConfigured();
  const files = process.argv.includes('--no-sample') ? FILES.filter((f) => !f.startsWith('08')) : FILES;
  const conn = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, multipleStatements: true });
  try {
    const [exists] = await conn.query('SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [env.db.name, 'users']);
    if (exists[0].c) { console.log(`Schema already present in ${env.db.name}; nothing to do.`); return; }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    console.log(`Initialising ${env.db.name}`);
    await runScripts(conn, env.db.name, files);
    console.log('Done.');
  } finally { await conn.end(); }
}
if (require.main === module) main().catch((e) => { console.error('db:init failed:', e.message); process.exit(1); });
module.exports = { runScripts, FILES };

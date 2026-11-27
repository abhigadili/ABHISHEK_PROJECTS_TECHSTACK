/* Database tooling: create | migrate | seed | reset
 *   create  - CREATE DATABASE IF NOT EXISTS (+ app user when DB_ADMIN_* is set)
 *   migrate - apply database/migrations/*.sql in order, once each (schema_migrations)
 *   seed    - development sample data (catalog, copies, demo users)
 *   reset   - drop + create + migrate (development / tests only)
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';

const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');
const SEEDS = path.resolve(__dirname, '../../database/seeds');

const ident = (n: string) => {
  if (!/^[A-Za-z0-9_]+$/.test(n)) throw new Error(`Unsafe identifier: ${n}`);
  return '`' + n + '`';
};

async function adminConn(withDb = false) {
  return mysql.createConnection({
    host: env.DB_HOST, port: env.DB_PORT,
    user: env.DB_ADMIN_USER ?? env.DB_USER,
    password: env.DB_ADMIN_USER ? env.DB_ADMIN_PASSWORD ?? '' : env.DB_PASSWORD,
    database: withDb ? env.DB_NAME : undefined,
    multipleStatements: true, charset: 'utf8mb4',
  });
}

export async function createDb() {
  const c = await adminConn();
  await c.query(`CREATE DATABASE IF NOT EXISTS ${ident(env.DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  if (env.DB_ADMIN_USER && env.DB_USER !== env.DB_ADMIN_USER) {
    await c.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [env.DB_USER, env.DB_PASSWORD]);
    await c.query(`GRANT ALL PRIVILEGES ON ${ident(env.DB_NAME)}.* TO ?@'%'`, [env.DB_USER]);
  }
  await c.end();
  console.log(`database ${env.DB_NAME} ready`);
}

export async function migrate() {
  const c = await adminConn(true);
  await c.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  const [done] = await c.query('SELECT filename FROM schema_migrations');
  const applied = new Set((done as any[]).map((r) => r.filename));
  for (const f of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(f)) continue;
    console.log(`applying ${f}`);
    await c.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
    await c.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f]);
  }
  await c.end();
  console.log('migrations up to date');
}

export async function seed() {
  const c = await adminConn(true);
  const [[{ n }]] = (await c.query('SELECT COUNT(*) AS n FROM books')) as any;
  if (n > 0) { console.log('books table is not empty - skipping seed'); await c.end(); return; }
  await c.query(fs.readFileSync(path.join(SEEDS, '001_dev_catalog.sql'), 'utf8'));

  // 2-3 physical copies per book, each with its own accession number.
  const [books] = (await c.query('SELECT id, location FROM books ORDER BY id')) as any;
  for (const b of books) {
    const copies = 2 + (b.id % 2);
    for (let i = 1; i <= copies; i++) {
      await c.query('INSERT INTO book_copies (book_id, accession_number, shelf_location, acquired_on) VALUES (?,?,?,?)',
        [b.id, `ACC-${String(b.id).padStart(5, '0')}-${i}`, b.location, '2026-01-15']);
    }
  }

  // Demo accounts. Passwords come from SEED_ADMIN_PASSWORD or are generated and printed once.
  const pw = env.SEED_ADMIN_PASSWORD ?? `Dev-${Math.random().toString(36).slice(2, 10)}A1!`;
  const hash = await bcrypt.hash(pw, 12);
  const users: [string, string, number][] = [
    ['admin@library.local', 'Alice Admin', 1],
    ['librarian@library.local', 'Liam Librarian', 2],
    ['member@library.local', 'Maya Member', 3],
  ];
  for (const [email, name, role] of users) {
    const [r] = (await c.query(`INSERT INTO users (email, password_hash, full_name, role_id, status) VALUES (?,?,?,?, 'active')`, [email, hash, name, role])) as any;
    if (role === 3) {
      const id = r.insertId;
      await c.query(`INSERT INTO member_profiles (user_id, member_code, registration_date, city, country) VALUES (?,?,CURDATE(),'Springfield','USA')`,
        [id, `LM${new Date().getFullYear()}${String(id).padStart(6, '0')}`]);
      await c.query(`INSERT INTO memberships (user_id, member_type_id, start_date, end_date, status) VALUES (?,3,CURDATE(),DATE_ADD(CURDATE(), INTERVAL 365 DAY),'active')`, [id]);
    }
  }
  await c.end();
  console.log('seeded catalog, copies and demo users (admin@library.local, librarian@library.local, member@library.local)');
  console.log(`demo password for all three: ${pw}`);
  console.log('These accounts are for development only - never seed production; use `npm run admin:create`.');
}

export async function reset() {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
  const c = await adminConn();
  await c.query(`DROP DATABASE IF EXISTS ${ident(env.DB_NAME)}`);
  await c.end();
  await createDb();
  await migrate();
}

if (require.main === module) {
  const cmd = process.argv[2];
  const run = { create: createDb, migrate, seed, reset }[cmd as 'create'];
  if (!run) { console.error('usage: db.ts create|migrate|seed|reset'); process.exit(1); }
  run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}

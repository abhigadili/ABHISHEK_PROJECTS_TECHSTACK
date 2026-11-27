// Rebuilds the throw-away `library_management_test` database (never the dev one) before the run.
export default async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = 'library_management_test';
  process.env.SEED_ADMIN_PASSWORD = 'Test#Pass123';
  const db = await import('../scripts/db');
  await db.reset();
  const log = console.log; console.log = () => {};
  try { await db.seed(); } finally { console.log = log; }
}

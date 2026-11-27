// Builds a fresh schema in the isolated *_test database. Refuses to touch any database whose name does not end in _test.
module.exports = async () => {
  process.env.NODE_ENV = 'test';
  const mysql = require('mysql2/promise');
  const env = require('../src/config/env');
  const { runScripts, FILES } = require('../scripts/db-init');
  if (!/_test$/.test(env.db.name)) throw new Error(`Refusing to run tests against non-test database "${env.db.name}"`);
  env.assertConfigured();
  const conn = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, database: env.db.name, multipleStatements: true });
  try {
    const [tables] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?', [env.db.name]);
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of tables) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
    for (const { t } of (await conn.query('SELECT table_name AS t FROM information_schema.views WHERE table_schema = ?', [env.db.name]))[0]) await conn.query(`DROP VIEW IF EXISTS \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await runScripts(conn, env.db.name, FILES.filter((f) => !f.startsWith('08'))); // schema + reference data, no sample employees
  } finally { await conn.end(); }
};

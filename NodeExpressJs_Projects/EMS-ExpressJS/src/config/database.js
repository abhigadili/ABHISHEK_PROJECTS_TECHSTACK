const mysql = require('mysql2/promise');
const env = require('./env');

let pool;

function getPool() {
  if (!pool) {
    env.assertConfigured();
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
      waitForConnections: true,
      connectionLimit: env.db.poolSize,
      timezone: 'Z',
      dateStrings: true, // DATE/DATETIME come back as strings: no implicit JS timezone shifts
      decimalNumbers: true,
      namedPlaceholders: false,
    });
  }
  return pool;
}

/** Run a parameterised query on the pool or on a given transaction connection. */
async function query(sql, params = [], conn) {
  const [rows] = await (conn || getPool()).query(sql, params);
  return rows;
}

async function withTransaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = { getPool, query, withTransaction, close };

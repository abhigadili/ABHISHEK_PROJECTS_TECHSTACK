import mysql, { Pool, PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { env } from '../config/env';

export type Conn = Pick<PoolConnection, 'query' | 'execute'>;
export type Params = (string | number | boolean | null | Date | Buffer)[];

export const poolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_POOL_SIZE,
  timezone: 'Z',
  // DATE columns stay 'YYYY-MM-DD' strings; DATETIME columns become JS Dates (UTC).
  dateStrings: ['DATE'] as ('DATE')[],
  decimalNumbers: true,
  charset: 'utf8mb4',
  multipleStatements: false,
};

let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool(poolConfig);
    // All timestamps (CURRENT_TIMESTAMP, CURDATE ...) are UTC, matching the app.
    pool.on('connection', (c) => { c.query("SET time_zone = '+00:00'"); });
  }
  return pool;
}
export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}

/** Parameterised query - values are never interpolated into SQL text. */
export async function query<T = any>(sql: string, params: Params = [], conn?: Conn): Promise<T[]> {
  const [rows] = await (conn ?? getPool()).query(sql, params);
  return rows as T[];
}
export async function queryOne<T = any>(sql: string, params: Params = [], conn?: Conn): Promise<T | null> {
  const rows = await query<T>(sql, params, conn);
  return rows[0] ?? null;
}
export async function exec(sql: string, params: Params = [], conn?: Conn): Promise<ResultSetHeader> {
  const [res] = await (conn ?? getPool()).query(sql, params);
  return res as ResultSetHeader;
}

/** Runs fn in a transaction; commits on success, rolls back on any throw. */
export async function withTx<T>(fn: (c: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const out = await fn(conn);
    await conn.commit();
    return out;
  } catch (e) {
    try { await conn.rollback(); } catch { /* connection already gone */ }
    throw e;
  } finally {
    conn.release();
  }
}

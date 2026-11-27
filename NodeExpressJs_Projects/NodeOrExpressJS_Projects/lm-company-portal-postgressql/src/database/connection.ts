// ============================================================
// WHAT: PostgreSQL connection pool using node-postgres (pg)
// WHY:  pg.Pool maintains a pool of reusable TCP connections.
//       Opening a new TCP connection per request is expensive (~30ms).
//       Pooling keeps connections alive and reuses them.
// HOW:  Pool is created once at startup, shared across all requests.
//       Each query borrows a connection from the pool and returns it.
// Interview Tip: In SQL databases YOU must CREATE the database first.
//               Unlike MongoDB, PostgreSQL won't auto-create it.
//               Run: CREATE DATABASE lmcompany; in psql first.
// ============================================================

import { Pool, PoolClient } from 'pg';
import { config } from '../config/env.config';
import { logger } from '../utils/logger';

// Singleton pool — created once, reused for all queries
export let pool: Pool;

export const connectDB = async (): Promise<void> => {
  pool = new Pool({
    host:     config.pg.host,
    port:     config.pg.port,
    user:     config.pg.user,
    password: config.pg.password,
    database: config.pg.database,
    max:      config.pg.poolMax,        // max connections in pool
    idleTimeoutMillis: 30000,           // close idle connections after 30s
    connectionTimeoutMillis: 2000,      // timeout waiting for a connection
  });

  // Test the connection
  try {
    const client = await pool.connect();
    logger.info(`PostgreSQL connected: ${config.pg.host}:${config.pg.port}/${config.pg.database}`);
    client.release();
  } catch (error) {
    logger.error('PostgreSQL connection failed:', error);
    process.exit(1);
  }

  pool.on('error', (err) => logger.error('PostgreSQL pool error:', err));
};

export const disconnectDB = async (): Promise<void> => {
  await pool.end();
  logger.info('PostgreSQL pool closed gracefully');
};

// Helper: run a parameterized query
// Interview Tip: ALWAYS use parameterized queries ($1, $2, ...) — never
//               string-interpolate user input into SQL. That causes SQL injection.
export const query = async <T = any>(
  text: string,
  params?: any[]
): Promise<T[]> => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`query: ${text} | params: ${JSON.stringify(params)} | rows: ${result.rowCount} | ${duration}ms`);
  return result.rows as T[];
};

// Helper: get a client for transactions
export const getClient = (): Promise<PoolClient> => pool.connect();

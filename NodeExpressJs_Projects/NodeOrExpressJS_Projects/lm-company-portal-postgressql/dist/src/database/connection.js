"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClient = exports.query = exports.disconnectDB = exports.connectDB = exports.pool = void 0;
const pg_1 = require("pg");
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const connectDB = async () => {
    exports.pool = new pg_1.Pool({
        host: env_config_1.config.pg.host,
        port: env_config_1.config.pg.port,
        user: env_config_1.config.pg.user,
        password: env_config_1.config.pg.password,
        database: env_config_1.config.pg.database,
        max: env_config_1.config.pg.poolMax, // max connections in pool
        idleTimeoutMillis: 30000, // close idle connections after 30s
        connectionTimeoutMillis: 2000, // timeout waiting for a connection
    });
    // Test the connection
    try {
        const client = await exports.pool.connect();
        logger_1.logger.info(`PostgreSQL connected: ${env_config_1.config.pg.host}:${env_config_1.config.pg.port}/${env_config_1.config.pg.database}`);
        client.release();
    }
    catch (error) {
        logger_1.logger.error('PostgreSQL connection failed:', error);
        process.exit(1);
    }
    exports.pool.on('error', (err) => logger_1.logger.error('PostgreSQL pool error:', err));
};
exports.connectDB = connectDB;
const disconnectDB = async () => {
    await exports.pool.end();
    logger_1.logger.info('PostgreSQL pool closed gracefully');
};
exports.disconnectDB = disconnectDB;
// Helper: run a parameterized query
// Interview Tip: ALWAYS use parameterized queries ($1, $2, ...) — never
//               string-interpolate user input into SQL. That causes SQL injection.
const query = async (text, params) => {
    const start = Date.now();
    const result = await exports.pool.query(text, params);
    const duration = Date.now() - start;
    logger_1.logger.debug(`query: ${text} | params: ${JSON.stringify(params)} | rows: ${result.rowCount} | ${duration}ms`);
    return result.rows;
};
exports.query = query;
// Helper: get a client for transactions
const getClient = () => exports.pool.connect();
exports.getClient = getClient;

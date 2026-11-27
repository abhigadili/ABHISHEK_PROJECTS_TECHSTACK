// ============================================================
// APPLICATION ENTRY POINT
// ============================================================
// WHAT: Boots the server — connects DB, starts Express, starts Node.js server.
// WHY:  Keeping startup logic here means app.ts stays testable (no port binding).
// HOW:  1. Connect PostgreSQL
//        2. Connect Redis
//        3. Init auth (configure Passport if OAuth2 enabled)
//        4. Start Express server (TYPE 2 & 3)
//        5. Start pure Node.js server (TYPE 1) on a separate port
// Interview Tip: process.on('uncaughtException') catches synchronous errors
//               that escape all try/catch blocks. Always handle it.
// ============================================================

import { connectDB } from '../database/connection';
import { redisClient } from '../cache/redis.client';
import { initAuth } from '../auth/auth.factory';
import { createApp } from './app';
import { createNodeServer } from './nodeServer';
import { config } from '../config/env.config';
import { logger } from '../utils/logger';

const NODE_SERVER_PORT = config.port + 1; // e.g. 5001

const start = async (): Promise<void> => {
  try {
    // 1. Connect to PostgreSQL
    await connectDB();

    // 2. Connect to Redis (lazy — first command connects)
    await redisClient.connect().catch(() => {
      // Redis failure is non-fatal — app works without cache (degraded mode)
      logger.warn('Redis not available — caching disabled');
    });

    // 3. Initialise authentication provider
    initAuth();

    // 4. Start Express application (TYPE 2 + TYPE 3 routes)
    const app = createApp();
    app.listen(config.port, () => {
      logger.info(`Express server running on http://localhost:${config.port}`);
      logger.info(`Swagger docs: http://localhost:${config.port}/api-docs`);
      logger.info(`Environment: ${config.env}`);
    });

    // 5. Start pure Node.js HTTP server (TYPE 1)
    // WHY separate port: to keep the two implementations independent and comparable
    const nodeServer = createNodeServer();
    nodeServer.listen(NODE_SERVER_PORT, () => {
      logger.info(`Node.js (pure http) server on http://localhost:${NODE_SERVER_PORT}`);
      logger.info(`  → GET http://localhost:${NODE_SERVER_PORT}/health`);
      logger.info(`  → GET http://localhost:${NODE_SERVER_PORT}/about-company`);
    });

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

// ---- Process-level error handling ----
// WHY: Without these, a single uncaught error can crash the entire Node.js process.
// Interview Tip: In production, use a process manager (PM2, systemd) to auto-restart.

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1); // restart via PM2
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Graceful shutdown — close DB connections before exiting
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  const { disconnectDB } = await import('../database/connection');
  await disconnectDB();
  await redisClient.quit();
  process.exit(0);
});

start();

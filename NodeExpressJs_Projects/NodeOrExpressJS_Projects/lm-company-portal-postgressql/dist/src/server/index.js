"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../database/connection");
const redis_client_1 = require("../cache/redis.client");
const auth_factory_1 = require("../auth/auth.factory");
const app_1 = require("./app");
const nodeServer_1 = require("./nodeServer");
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const NODE_SERVER_PORT = env_config_1.config.port + 1; // e.g. 5001
const start = async () => {
    try {
        // 1. Connect to PostgreSQL
        await (0, connection_1.connectDB)();
        // 2. Connect to Redis (lazy — first command connects)
        await redis_client_1.redisClient.connect().catch(() => {
            // Redis failure is non-fatal — app works without cache (degraded mode)
            logger_1.logger.warn('Redis not available — caching disabled');
        });
        // 3. Initialise authentication provider
        (0, auth_factory_1.initAuth)();
        // 4. Start Express application (TYPE 2 + TYPE 3 routes)
        const app = (0, app_1.createApp)();
        app.listen(env_config_1.config.port, () => {
            logger_1.logger.info(`Express server running on http://localhost:${env_config_1.config.port}`);
            logger_1.logger.info(`Swagger docs: http://localhost:${env_config_1.config.port}/api-docs`);
            logger_1.logger.info(`Environment: ${env_config_1.config.env}`);
        });
        // 5. Start pure Node.js HTTP server (TYPE 1)
        // WHY separate port: to keep the two implementations independent and comparable
        const nodeServer = (0, nodeServer_1.createNodeServer)();
        nodeServer.listen(NODE_SERVER_PORT, () => {
            logger_1.logger.info(`Node.js (pure http) server on http://localhost:${NODE_SERVER_PORT}`);
            logger_1.logger.info(`  → GET http://localhost:${NODE_SERVER_PORT}/health`);
            logger_1.logger.info(`  → GET http://localhost:${NODE_SERVER_PORT}/about-company`);
        });
    }
    catch (err) {
        logger_1.logger.error('Failed to start server:', err);
        process.exit(1);
    }
};
// ---- Process-level error handling ----
// WHY: Without these, a single uncaught error can crash the entire Node.js process.
// Interview Tip: In production, use a process manager (PM2, systemd) to auto-restart.
process.on('uncaughtException', (err) => {
    logger_1.logger.error('Uncaught Exception:', err);
    process.exit(1); // restart via PM2
});
process.on('unhandledRejection', (reason) => {
    logger_1.logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});
// Graceful shutdown — close DB connections before exiting
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received — shutting down gracefully');
    const { disconnectDB } = await Promise.resolve().then(() => __importStar(require('../database/connection')));
    await disconnectDB();
    await redis_client_1.redisClient.quit();
    process.exit(0);
});
start();

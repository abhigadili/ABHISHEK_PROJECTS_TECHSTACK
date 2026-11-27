"use strict";
// ============================================================
// WHAT: Redis client singleton using ioredis
// WHY:  Redis is an in-memory data store used for:
//       1. Caching API responses (reduce DB load)
//       2. Storing refresh token blocklist (logout)
//       3. Rate-limiting counters
//       4. Session storage
// HOW:  We export a single ioredis instance reused across the app.
// Interview Tip: Always handle Redis connection failures gracefully —
//               the app should still work without cache (degraded mode).
// Performance Consideration: Redis reduces MongoDB reads dramatically
//               for frequently accessed, rarely changed data (e.g. company list).
// ============================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTokenBlocklisted = exports.blocklistToken = exports.cacheDel = exports.cacheGet = exports.cacheSet = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const createRedisClient = () => {
    const client = new ioredis_1.default({
        host: env_config_1.config.redis.host,
        port: env_config_1.config.redis.port,
        password: env_config_1.config.redis.password || undefined,
        // Retry strategy: back off exponentially up to 30 sec
        retryStrategy: (times) => {
            if (times > 10) {
                logger_1.logger.error('Redis max retries reached. Giving up.');
                return null; // stop retrying
            }
            return Math.min(times * 100, 3000);
        },
        lazyConnect: true, // don't connect until first command
    });
    client.on('connect', () => logger_1.logger.info('Redis connected'));
    client.on('ready', () => logger_1.logger.info('Redis ready'));
    client.on('error', (err) => logger_1.logger.error('Redis error:', err));
    client.on('close', () => logger_1.logger.warn('Redis connection closed'));
    return client;
};
exports.redisClient = createRedisClient();
// ---- Helper wrappers ----
// Cache: store a value with optional TTL (seconds)
// Interview Tip: JSON.stringify/parse because Redis stores strings.
const cacheSet = async (key, value, ttl) => {
    try {
        const serialized = JSON.stringify(value);
        if (ttl) {
            await exports.redisClient.setex(key, ttl, serialized);
        }
        else {
            await exports.redisClient.set(key, serialized);
        }
    }
    catch (err) {
        logger_1.logger.warn(`Cache SET failed for key "${key}":`, err);
        // Don't throw — cache failure is non-fatal
    }
};
exports.cacheSet = cacheSet;
// Cache: retrieve and deserialise a stored value
// Returns null on cache miss or error (caller handles the miss)
const cacheGet = async (key) => {
    try {
        const value = await exports.redisClient.get(key);
        if (!value)
            return null; // CACHE MISS
        return JSON.parse(value);
    }
    catch (err) {
        logger_1.logger.warn(`Cache GET failed for key "${key}":`, err);
        return null;
    }
};
exports.cacheGet = cacheGet;
// Cache invalidation: delete one or more keys
// WHY: After a write (create/update/delete), cached data is stale.
const cacheDel = async (...keys) => {
    try {
        await exports.redisClient.del(...keys);
    }
    catch (err) {
        logger_1.logger.warn(`Cache DEL failed for keys "${keys.join(', ')}":`, err);
    }
};
exports.cacheDel = cacheDel;
// Blocklist a JWT (on logout) until its natural expiry
// WHY: JWTs are stateless — you can't "revoke" them without a blocklist.
const blocklistToken = async (token, expirySeconds) => {
    await exports.redisClient.setex(`blocklist:${token}`, expirySeconds, '1');
};
exports.blocklistToken = blocklistToken;
const isTokenBlocklisted = async (token) => {
    const result = await exports.redisClient.get(`blocklist:${token}`);
    return result !== null;
};
exports.isTokenBlocklisted = isTokenBlocklisted;

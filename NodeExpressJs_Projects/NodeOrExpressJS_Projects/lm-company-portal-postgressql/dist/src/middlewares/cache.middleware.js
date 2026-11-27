"use strict";
// ============================================================
// WHAT: HTTP response caching middleware using Redis
// WHY:  Caching reduces database load and improves response time.
//       A cache hit returns data in <1ms vs 10-100ms for a DB query.
// HOW:  Before reaching the controller, check Redis for a cached response.
//       If found (cache HIT) → return immediately.
//       If not found (cache MISS) → run the controller, then cache the response.
// When to use: GET endpoints for data that changes infrequently (companies, rooms).
// When NOT to use: POST/PUT/DELETE (write operations), user-specific data,
//                  real-time data (stock prices, availability status).
// Interview Tip: Cache invalidation is "one of the two hard things in CS."
//               Always invalidate the cache when the underlying data changes.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheMiddleware = void 0;
const redis_client_1 = require("../cache/redis.client");
const env_config_1 = require("../config/env.config");
const logger_1 = require("../utils/logger");
const cacheMiddleware = (key, ttl = env_config_1.config.redis.ttl) => {
    return async (req, res, next) => {
        try {
            // Build a key that includes query params so /rooms?floor=2 ≠ /rooms
            const cacheKey = `${key}:${JSON.stringify(req.query)}`;
            const cached = await (0, redis_client_1.cacheGet)(cacheKey);
            if (cached) {
                // CACHE HIT: return without touching the database
                logger_1.logger.debug(`Cache HIT: ${cacheKey}`);
                res.setHeader('x-cache', 'HIT');
                res.status(200).json(cached);
                return;
            }
            // CACHE MISS: run the controller, intercept the response
            logger_1.logger.debug(`Cache MISS: ${cacheKey}`);
            res.setHeader('x-cache', 'MISS');
            // Override res.json to cache the response before sending
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                // Only cache successful responses
                if (res.statusCode === 200) {
                    (0, redis_client_1.cacheSet)(cacheKey, body, ttl).catch(err => logger_1.logger.warn('Failed to cache response:', err));
                }
                return originalJson(body);
            };
            next();
        }
        catch (err) {
            // Cache errors must not break the request
            logger_1.logger.warn('Cache middleware error:', err);
            next();
        }
    };
};
exports.cacheMiddleware = cacheMiddleware;

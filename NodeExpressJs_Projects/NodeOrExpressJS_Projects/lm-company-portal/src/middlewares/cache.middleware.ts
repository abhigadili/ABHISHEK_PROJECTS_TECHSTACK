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

import { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet } from '../cache/redis.client';
import { config } from '../config/env.config';
import { logger } from '../utils/logger';

export const cacheMiddleware = (key: string, ttl = config.redis.ttl) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Build a key that includes query params so /rooms?floor=2 ≠ /rooms
      const cacheKey = `${key}:${JSON.stringify(req.query)}`;

      const cached = await cacheGet(cacheKey);
      if (cached) {
        // CACHE HIT: return without touching the database
        logger.debug(`Cache HIT: ${cacheKey}`);
        res.setHeader('x-cache', 'HIT');
        res.status(200).json(cached);
        return;
      }

      // CACHE MISS: run the controller, intercept the response
      logger.debug(`Cache MISS: ${cacheKey}`);
      res.setHeader('x-cache', 'MISS');

      // Override res.json to cache the response before sending
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        // Only cache successful responses
        if (res.statusCode === 200) {
          cacheSet(cacheKey, body, ttl).catch(err =>
            logger.warn('Failed to cache response:', err)
          );
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      // Cache errors must not break the request
      logger.warn('Cache middleware error:', err);
      next();
    }
  };
};

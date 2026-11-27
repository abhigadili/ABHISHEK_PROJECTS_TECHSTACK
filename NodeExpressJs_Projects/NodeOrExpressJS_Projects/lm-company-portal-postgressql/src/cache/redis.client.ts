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

import Redis from 'ioredis';
import { config } from '../config/env.config';
import { logger } from '../utils/logger';

const createRedisClient = (): Redis => {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    // Retry strategy: back off exponentially up to 30 sec
    retryStrategy: (times) => {
      if (times > 10) {
        logger.error('Redis max retries reached. Giving up.');
        return null; // stop retrying
      }
      return Math.min(times * 100, 3000);
    },
    lazyConnect: true, // don't connect until first command
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('ready', () => logger.info('Redis ready'));
  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('close', () => logger.warn('Redis connection closed'));

  return client;
};

export const redisClient = createRedisClient();

// ---- Helper wrappers ----

// Cache: store a value with optional TTL (seconds)
// Interview Tip: JSON.stringify/parse because Redis stores strings.
export const cacheSet = async (key: string, value: unknown, ttl?: number): Promise<void> => {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  } catch (err) {
    logger.warn(`Cache SET failed for key "${key}":`, err);
    // Don't throw — cache failure is non-fatal
  }
};

// Cache: retrieve and deserialise a stored value
// Returns null on cache miss or error (caller handles the miss)
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await redisClient.get(key);
    if (!value) return null; // CACHE MISS
    return JSON.parse(value) as T;
  } catch (err) {
    logger.warn(`Cache GET failed for key "${key}":`, err);
    return null;
  }
};

// Cache invalidation: delete one or more keys
// WHY: After a write (create/update/delete), cached data is stale.
export const cacheDel = async (...keys: string[]): Promise<void> => {
  try {
    await redisClient.del(...keys);
  } catch (err) {
    logger.warn(`Cache DEL failed for keys "${keys.join(', ')}":`, err);
  }
};

// Blocklist a JWT (on logout) until its natural expiry
// WHY: JWTs are stateless — you can't "revoke" them without a blocklist.
export const blocklistToken = async (token: string, expirySeconds: number): Promise<void> => {
  await redisClient.setex(`blocklist:${token}`, expirySeconds, '1');
};

export const isTokenBlocklisted = async (token: string): Promise<boolean> => {
  const result = await redisClient.get(`blocklist:${token}`);
  return result !== null;
};

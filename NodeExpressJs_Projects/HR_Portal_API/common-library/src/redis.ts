import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { config } from './config';
import { logger } from './logger';

let client: Redis | undefined;

export function redis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableOfflineQueue: false, lazyConnect: false, retryStrategy: (n) => Math.min(n * 500, 5000) });
    client.on('error', (e) => logger.warn({ err: e.message }, 'redis error'));
  }
  return client;
}

/** Cache key design: hr:<service>:<entity>:<qualifier>. Values are JSON; every key has a TTL. */
export const key = (...parts: (string | number)[]): string => ['hr', ...parts].join(':');

export const cache = {
  async get<T>(k: string): Promise<T | null> {
    try {
      const v = await redis().get(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch { return null; }
  },
  async set(k: string, value: unknown, ttlSeconds: number): Promise<void> {
    try { await redis().set(k, JSON.stringify(value), 'EX', ttlSeconds); } catch { /* cache is best effort */ }
  },
  /** Cache-aside read. Never use for sensitive data without access-controlled keys. */
  async getOrLoad<T>(k: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = await cache.get<T>(k);
    if (hit !== null) return hit;
    const fresh = await loader();
    if (fresh !== undefined && fresh !== null) await cache.set(k, fresh, ttlSeconds);
    return fresh;
  },
  async del(...keys: string[]): Promise<void> {
    if (!keys.length) return;
    try { await redis().del(...keys); } catch { /* ignore */ }
  },
  /** Evict every key matching a prefix using SCAN (never KEYS). */
  async evictPrefix(prefix: string): Promise<number> {
    let n = 0;
    try {
      const stream = redis().scanStream({ match: `${prefix}*`, count: 200 });
      for await (const keys of stream as AsyncIterable<string[]>) {
        if (keys.length) { await redis().del(...keys); n += keys.length; }
      }
    } catch { /* ignore */ }
    return n;
  },
};

/** Distributed lock (SET NX PX) with owner token and Lua-safe release. */
export async function withLock<T>(name: string, ttlMs: number, fn: () => Promise<T>): Promise<T | undefined> {
  const k = key('lock', name);
  const token = uuid();
  let acquired = false;
  try { acquired = (await redis().set(k, token, 'PX', ttlMs, 'NX')) === 'OK'; } catch { acquired = true; /* redis down: degrade to unlocked */ }
  if (!acquired) return undefined;
  try {
    return await fn();
  } finally {
    try {
      await redis().eval(`if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end`, 1, k, token);
    } catch { /* lock expires by TTL */ }
  }
}

/** Fixed-window rate limiter. Returns remaining quota; fails open when Redis is unavailable. */
export async function rateLimit(id: string, limit: number, windowSeconds = 60): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const k = key('rate', id, Math.floor(Date.now() / (windowSeconds * 1000)));
    const n = await redis().incr(k);
    if (n === 1) await redis().expire(k, windowSeconds + 1);
    return { allowed: n <= limit, remaining: Math.max(0, limit - n) };
  } catch { return { allowed: true, remaining: limit }; }
}

/** JWT invalidation: blacklisted jti values live until the token would have expired anyway. */
export const tokenBlacklist = {
  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    try { await redis().set(key('jwt', 'revoked', jti), '1', 'EX', Math.max(1, ttlSeconds)); } catch { /* ignore */ }
  },
  async isRevoked(jti: string): Promise<boolean> {
    try { return (await redis().exists(key('jwt', 'revoked', jti))) === 1; } catch { return false; }
  },
  async revokeAllForUser(userId: string, ttlSeconds: number): Promise<void> {
    try { await redis().set(key('jwt', 'user-revoked', userId), String(Date.now()), 'EX', ttlSeconds); } catch { /* ignore */ }
  },
  async userRevokedAt(userId: string): Promise<number | null> {
    try { const v = await redis().get(key('jwt', 'user-revoked', userId)); return v ? Number(v) : null; } catch { return null; }
  },
};

/** Short-lived idempotency record for critical POSTs (Idempotency-Key header). */
export async function claimIdempotencyKey(scope: string, idemKey: string, ttlSeconds = 86400): Promise<boolean> {
  try { return (await redis().set(key('idem', scope, idemKey), '1', 'EX', ttlSeconds, 'NX')) === 'OK'; } catch { return true; }
}

/** Notification de-duplication window. */
export async function seenRecently(dedupeKey: string, ttlSeconds = 3600): Promise<boolean> {
  try { return (await redis().set(key('dedupe', dedupeKey), '1', 'EX', ttlSeconds, 'NX')) !== 'OK'; } catch { return false; }
}

export async function closeRedis(): Promise<void> {
  if (client) { await client.quit().catch(() => undefined); client = undefined; }
}

import { createClient } from 'redis';

/**
 * Reusable Redis (node-redis) cache. JSON values, per-call TTL. FAIL-OPEN: when Redis is down every call
 * returns immediately as a miss / no-op, so requests are simply served from MySQL.
 */
export function createCache({ url, service, logger }) {
  const prefix = `hospital:${service}:`;
  const client = createClient({ url, socket: { connectTimeout: 1000, reconnectStrategy: (n) => Math.min(n * 500, 5000) } });
  let lastWarn = 0;
  client.on('error', (e) => {
    if (Date.now() - lastWarn > 30000) { lastWarn = Date.now(); logger.warn({ err: e.message }, 'Redis error (cache degraded to database reads)'); }
  });
  client.on('ready', () => logger.info('Redis connected'));
  const ok = () => client.isReady;
  const safe = async (op, fn, dflt) => { if (!ok()) return dflt; try { return await fn(); } catch (e) { logger.warn({ op, err: e.message }, 'Cache operation failed'); return dflt; } };

  const api = {
    async connect() { client.connect().catch((e) => logger.warn({ err: e.message }, 'Redis not reachable at start-up; running without cache')); },
    get: (key) => safe('get', async () => { const v = await client.get(prefix + key); return v === null ? undefined : JSON.parse(v); }, undefined),
    set: (key, value, ttlSec) => safe('set', () => client.set(prefix + key, JSON.stringify(value), { EX: ttlSec }), undefined),
    del: (...keys) => safe('del', () => client.del(keys.map((k) => prefix + k)), undefined),
    /** cache-aside: returns the cached value or loads it (null/undefined results are not cached) */
    async getOrSet(key, ttlSec, loader) {
      const hit = await api.get(key);
      if (hit !== undefined) return hit;
      const value = await loader();
      if (value !== null && value !== undefined) await api.set(key, value, ttlSec);
      return value;
    },
    async close() { if (client.isOpen) await client.quit().catch(() => client.disconnect()); },
  };
  return api;
}

import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

/** Walk up from cwd until a .env is found (services run from their folder or the repo root). */
function loadEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.env');
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    dir = path.dirname(dir);
  }
}
loadEnv();

export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v !== undefined && v !== '') return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable ${name}`);
}

export const envInt = (name: string, fallback: number): number => {
  const v = process.env[name];
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export const envBool = (name: string, fallback: boolean): boolean => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

export const config = {
  get mysql() {
    return {
      host: env('MYSQL_HOST', '127.0.0.1'),
      port: envInt('MYSQL_PORT', 3306),
      user: env('MYSQL_USER'),
      password: env('MYSQL_PASSWORD'),
      poolSize: envInt('DB_POOL_SIZE', 10),
      connectTimeoutMs: envInt('DB_CONNECT_TIMEOUT_MS', 10000),
      queryTimeoutMs: envInt('DB_QUERY_TIMEOUT_MS', 30000),
    };
  },
  get redisUrl() {
    return env('REDIS_URL', 'redis://127.0.0.1:9479');
  },
  get kafka() {
    return {
      enabled: envBool('KAFKA_ENABLED', true),
      brokers: env('KAFKA_BROKERS', '127.0.0.1:9292').split(','),
      prefix: env('KAFKA_CLIENT_PREFIX', 'hr-node'),
    };
  },
  get jwt() {
    return {
      secret: env('JWT_SECRET'),
      accessTtl: envInt('JWT_ACCESS_TTL_SECONDS', 900),
      refreshTtl: envInt('JWT_REFRESH_TTL_SECONDS', 604800),
    };
  },
  get internalToken() {
    return env('INTERNAL_SERVICE_TOKEN');
  },
  get corsOrigins() {
    return env('CORS_ORIGINS', 'http://localhost:3000').split(',').map((s) => s.trim());
  },
  get storageDir() {
    return path.resolve(env('STORAGE_DIR', './storage'));
  },
  get maxUploadBytes() {
    return envInt('MAX_UPLOAD_MB', 10) * 1024 * 1024;
  },
};

/** Environment-based service discovery: ORGANIZATION_SERVICE_URL, ... */
export function serviceUrl(service: string): string {
  return env(`${service.toUpperCase()}_SERVICE_URL`);
}

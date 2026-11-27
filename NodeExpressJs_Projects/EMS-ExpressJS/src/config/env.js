const path = require('path');
const dotenv = require('dotenv');

const load = (f) => dotenv.config({ path: path.resolve(__dirname, '../../', f), quiet: true });
if (process.env.NODE_ENV === 'test') load('.env.test');
load('.env');

const int = (v, d) => (v === undefined || v === '' ? d : parseInt(v, 10));
const isTest = process.env.NODE_ENV === 'test';

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: int(process.env.PORT, 4100),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: isTest ? process.env.TEST_DB_NAME || 'ems_expressjs_test' : process.env.DB_NAME || 'ems_expressjs',
    poolSize: int(process.env.DB_POOL_SIZE, 10),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
  },
  bcryptRounds: isTest ? 4 : int(process.env.BCRYPT_ROUNDS, 12),
  corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'UTC',
  rateLimit: {
    loginMax: int(process.env.LOGIN_RATE_LIMIT_MAX, 10),
    apiMax: isTest ? 100000 : int(process.env.API_RATE_LIMIT_MAX, 300),
  },
  attendance: {
    fullDayHours: parseFloat(process.env.FULL_DAY_HOURS || '6'),
  },
  exposeResetToken: process.env.EXPOSE_RESET_TOKEN === 'true' && process.env.NODE_ENV !== 'production',
  maxUploadBytes: int(process.env.MAX_UPLOAD_BYTES, 2 * 1024 * 1024),
};

function assertConfigured() {
  const missing = [];
  if (!env.db.user) missing.push('DB_USER');
  if (!env.db.password) missing.push('DB_PASSWORD');
  if (!env.jwt.accessSecret || env.jwt.accessSecret.length < 16) missing.push('JWT_ACCESS_SECRET (>=16 chars)');
  if (missing.length) throw new Error(`Missing/invalid environment configuration: ${missing.join(', ')}`);
}

module.exports = { ...env, assertConfigured };

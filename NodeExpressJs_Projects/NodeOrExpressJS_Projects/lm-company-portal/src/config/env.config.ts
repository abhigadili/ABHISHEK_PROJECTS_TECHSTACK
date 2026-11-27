// ============================================================
// WHAT: Central environment configuration loader
// WHY:  Reading process.env everywhere is brittle — typos fail
//       silently. A single typed config object catches them at
//       startup and provides IntelliSense throughout the app.
// HOW:  dotenv populates process.env from .env; we read + validate
//       here, then export a typed object used everywhere else.
// Interview Tip: Always validate required env vars at boot time.
// ============================================================

import dotenv from 'dotenv';

// Load .env file before anything else reads process.env
dotenv.config();

// Helper: throws at startup if a required variable is missing
const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optional = (key: string, fallback = ''): string =>
  process.env[key] ?? fallback;

export const config = {
  // ---- Application ----
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '5000'), 10),
  isDev: optional('NODE_ENV', 'development') === 'development',
  isProd: optional('NODE_ENV', 'development') === 'production',

  // ---- Database ----
  mongo: {
    uri: optional('MONGO_URI', 'mongodb://localhost:27017/lmcompany'),
  },

  // ---- Redis ----
  redis: {
    host: optional('REDIS_HOST', '127.0.0.1'),
    port: parseInt(optional('REDIS_PORT', '6379'), 10),
    password: optional('REDIS_PASSWORD'),
    ttl: parseInt(optional('REDIS_TTL', '3600'), 10), // seconds
  },

  // ---- JWT ----
  // Access token: short-lived credential for API calls (15 min default)
  // Refresh token: long-lived, stored server-side, used only to rotate access tokens
  jwt: {
    secret: optional('JWT_SECRET', 'fallback_secret_change_me'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'fallback_refresh_secret'),
    expiresIn: optional('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  // ---- Auth Provider ----
  // 'jwt'    → username/password login, JWT tokens only
  // 'oauth2' → Google/GitHub OAuth, app still issues JWT after OAuth success
  auth: {
    provider: optional('AUTH_PROVIDER', 'jwt') as 'jwt' | 'oauth2',
    enableOAuth2: optional('ENABLE_OAUTH2', 'false') === 'true',
  },

  // ---- OAuth2 ----
  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
    clientSecret: optional('GOOGLE_CLIENT_SECRET'),
    callbackUrl: optional('GOOGLE_CALLBACK_URL', 'http://localhost:5000/api/auth/google/callback'),
  },
  github: {
    clientId: optional('GITHUB_CLIENT_ID'),
    clientSecret: optional('GITHUB_CLIENT_SECRET'),
    callbackUrl: optional('GITHUB_CALLBACK_URL', 'http://localhost:5000/api/auth/github/callback'),
  },

  // ---- CORS ----
  cors: {
    origins: optional('CORS_ORIGIN', 'http://localhost:3000').split(',').map(o => o.trim()),
  },

  // ---- Security ----
  apiKey: optional('API_KEY', 'dev_api_key'),

  // ---- Rate Limiting ----
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
  },

  // ---- Logging ----
  logLevel: optional('LOG_LEVEL', 'debug'),
} as const;

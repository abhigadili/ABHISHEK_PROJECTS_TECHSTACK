import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// .env lives in backend/ (the working directory for every npm script), for both src/ and dist/ runs.
dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

const bool = (def: boolean) =>
  z.string().optional().transform((v) => (v === undefined ? def : ['1', 'true', 'yes'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('lms'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('library_management'),
  DB_ADMIN_USER: z.string().optional(),
  DB_ADMIN_PASSWORD: z.string().optional(),
  DB_POOL_SIZE: z.coerce.number().default(10),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
  SESSION_COOKIE_NAME: z.string().default('lms_session'),
  SESSION_TTL_HOURS: z.coerce.number().default(168),
  COOKIE_SECURE: bool(false),
  TRUST_PROXY: bool(false),
  RATE_LIMIT_ENABLED: bool(true),
  MAX_UPLOAD_BYTES: z.coerce.number().default(2 * 1024 * 1024),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().default(60),
  // Only honoured outside production: returns the reset link in the API response
  // so the flow can be exercised without an email provider.
  EXPOSE_RESET_LINK: bool(false),
  APP_BASE_URL: z.string().default('http://localhost:3000'),
  JOBS_ENABLED: bool(true),
  // Optional email provider (not bundled). When unset, notifications are in-app only.
  SMTP_HOST: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
if (isProd && !env.COOKIE_SECURE) {
  console.warn('[config] COOKIE_SECURE is false in production - session cookies will be sent over plain HTTP.');
}

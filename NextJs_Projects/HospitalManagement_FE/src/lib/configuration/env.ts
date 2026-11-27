import 'server-only';

/** Server-side configuration layer: every secret comes from the environment; missing required values fail fast with a clear message. */
const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name} - see .env.example`);
  return v;
};
const opt = (name: string, d = '') => process.env[name] ?? d;

export const env = {
  get jwtSecret() { return new TextEncoder().encode(need('JWT_ACCESS_SECRET')); },
  get refreshPepper() { return need('REFRESH_TOKEN_PEPPER'); },
  get mfaKey() { return need('MFA_ENCRYPTION_KEY'); },
  accessTtl: Number(opt('ACCESS_TOKEN_TTL_SECONDS', '900')),
  refreshTtlDays: Number(opt('REFRESH_TOKEN_TTL_DAYS', '7')),
  cookieSecure: opt('COOKIE_SECURE') === 'true',
  appUrl: opt('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
  appName: opt('NEXT_PUBLIC_APP_NAME', 'CityCare HMS'),
  google: { id: opt('OAUTH_GOOGLE_CLIENT_ID'), secret: opt('OAUTH_GOOGLE_CLIENT_SECRET'), redirect: opt('OAUTH_GOOGLE_REDIRECT_URI') },
  smtp: { host: opt('SMTP_HOST'), port: Number(opt('SMTP_PORT', '587')), user: opt('SMTP_USER'), password: opt('SMTP_PASSWORD'), from: opt('SMTP_FROM', 'CityCare HMS <no-reply@example.com>') },
  paymentProvider: opt('PAYMENT_PROVIDER', 'demo'),
  taxRate: Number(opt('INVOICE_TAX_RATE', '5')),
  uploadDir: opt('UPLOAD_DIR', './uploads'),
  maxUploadBytes: Number(opt('MAX_UPLOAD_MB', '5')) * 1024 * 1024,
  isProd: process.env.NODE_ENV === 'production',
};
export const oauthGoogleEnabled = () => !!(env.google.id && env.google.secret && env.google.redirect);

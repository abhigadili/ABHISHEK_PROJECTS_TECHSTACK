import 'dotenv/config';
import { z } from 'zod';

/** Environment configuration: validated once at start-up so a missing secret fails fast with a readable message. */
const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY_DAYS: z.coerce.number().default(7),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default('Train Ticket Booking <no-reply@example.com>'),
  PAYMENT_PROVIDER: z.string().default('simulation'),
  SEAT_HOLD_MINUTES: z.coerce.number().default(10),
  MAX_PASSENGERS_PER_BOOKING: z.coerce.number().default(6),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) { console.error('Invalid environment configuration:\n' + parsed.error.issues.map((i) => ` - ${i.path.join('.')}: ${i.message}`).join('\n')); process.exit(1); }
export const env = { ...parsed.data, isProd: parsed.data.NODE_ENV === 'production', cookieSecure: parsed.data.COOKIE_SECURE === 'true' };

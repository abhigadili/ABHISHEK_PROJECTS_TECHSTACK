import 'server-only';
import { z } from 'zod';

/**
 * Validated server environment. `server-only` makes the build FAIL if a Client Component ever imports this file, so the private API
 * URL and secrets can never be bundled for the browser.
 */
const schema = z.object({
  EMS_API_URL: z.string().url().default('http://localhost:4100/api/v1'),
  EMS_REVALIDATE_SECRET: z.string().min(16).optional(),
  EMS_API_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(10_000),
});

export const env = schema.parse({
  EMS_API_URL: process.env.EMS_API_URL,
  EMS_REVALIDATE_SECRET: process.env.EMS_REVALIDATE_SECRET,
  EMS_API_TIMEOUT_MS: process.env.EMS_API_TIMEOUT_MS,
});
export const isProd = process.env.NODE_ENV === 'production';

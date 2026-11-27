// Copied from the backend's shared Zod schemas (backend/src/validations) so the frontend validates exactly like the API - the backend itself is not touched.
import { z } from 'zod';
/** Shared schemas (imported by BOTH the Express API and the React app through the `@shared` alias) - keep this folder free of Node-only code. */
export const email = z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(160);
export const mobile = z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number');
export const password = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[a-z]/, 'Add a lowercase letter').regex(/\d/, 'Add a digit');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
export const gender = z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Select a gender' });
export const pageQuery = z.object({
  page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().max(100).optional(), sort: z.string().max(40).optional(), dir: z.enum(['asc', 'desc']).default('asc'),
});
export type PageQuery = z.infer<typeof pageQuery>;

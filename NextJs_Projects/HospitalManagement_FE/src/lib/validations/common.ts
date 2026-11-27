import { z } from 'zod';
/** Shared (client + server) schema building blocks. */
export const password = z.string().min(10, 'At least 10 characters').max(72, 'At most 72 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[a-z]/, 'Add a lowercase letter').regex(/\d/, 'Add a digit');
export const email = z.string().trim().toLowerCase().email('Enter a valid e-mail address').max(160);
export const phone = z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'Use 7-15 digits, optional leading +');
export const optionalPhone = z.string().trim().refine((v) => v === '' || /^\+?[0-9]{7,15}$/.test(v), 'Use 7-15 digits, optional leading +');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
export const pageQuery = z.object({ page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(15), q: z.string().trim().max(100).optional(), sort: z.string().max(40).optional(), dir: z.enum(['asc', 'desc']).default('desc') });
export type PageQuery = z.infer<typeof pageQuery>;
export const idParam = z.coerce.number().int().positive();
export const emptyToUndef = (s?: string | null) => (s === undefined || s === null || s.trim() === '' ? undefined : s.trim());

import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const patientParams = z.object({ patientId: z.coerce.number().int().positive() });
export const doctorParams = z.object({ doctorId: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const today = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };
const futureOrToday = dateStr.refine((d) => d >= today(), 'must be today or a future date');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm');

export const bookBody = z.object({ patientId: z.number().int().positive(), doctorId: z.number().int().positive(), date: futureOrToday, startTime: hhmm, reason: z.string().max(255).optional().nullable() });
export const rescheduleBody = z.object({ date: futureOrToday, startTime: hhmm });
export const cancelBody = z.object({ reason: z.string().max(255).optional().nullable() }).optional().default({});
export const completeBody = z.object({ notes: z.string().max(1000).optional().nullable() }).optional().default({});
export const availabilityQuery = z.object({ doctorId: z.coerce.number().int().positive(), date: dateStr });
export const doctorQuery = z.object({ date: dateStr.optional() });

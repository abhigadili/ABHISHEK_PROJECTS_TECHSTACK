import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const unavailParams = z.object({ id: z.coerce.number().int().positive(), unavailabilityId: z.coerce.number().int().positive() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm');
export const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export const doctorBody = z.object({
  firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), email: z.email().max(120),
  phone: z.string().regex(/^\+?[0-9]{7,15}$/, 'must be 7-15 digits, optional leading +').optional().nullable(),
  licenseNumber: z.string().trim().min(1).max(40), specialization: z.string().trim().min(1).max(80),
  qualification: z.string().max(150).optional().nullable(), experienceYears: z.number().int().min(0).max(70).optional().nullable(),
  consultationFee: z.number().min(0).max(1000000), hospitalId: z.number().int().positive(), departmentId: z.number().int().positive().optional().nullable(),
  userId: z.number().int().positive().optional().nullable(),
});
export const searchQuery = z.object({
  specialization: z.string().optional(), hospitalId: z.coerce.number().int().optional(), departmentId: z.coerce.number().int().optional(),
  active: z.enum(['true', 'false']).optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20),
});
export const dateQuery = z.object({ date: dateStr });
export const availableQuery = z.object({ date: dateStr, specialization: z.string().optional() });
export const scheduleBody = z.object({
  days: z.array(z.object({
    dayOfWeek: z.enum(DAYS), startTime: hhmm, endTime: hhmm, slotMinutes: z.number().int().min(5).max(180),
    breakStart: hhmm.optional().nullable(), breakEnd: hhmm.optional().nullable(),
  })),
});
export const unavailabilityBody = z.object({ date: dateStr, reason: z.string().max(200).optional().nullable() });

import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const userParams = z.object({ userId: z.coerce.number().int().positive() });
const phone = z.string().regex(/^\+?[0-9]{7,15}$/, 'must be 7-15 digits, optional leading +');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const patientBody = z.object({
  firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60),
  dateOfBirth: dateStr.refine((d) => new Date(d) < new Date(), 'must be a date in the past'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  email: z.email().max(120), phone,
  identityNumber: z.string().max(40).optional().nullable(),
  bloodGroup: z.string().regex(/^(A|B|AB|O)[+-]$/, 'must be A+, A-, B+, B-, AB+, AB-, O+ or O-').optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: phone.optional().nullable(),
  knownAllergies: z.string().max(500).optional().nullable(),
  userId: z.number().int().positive().optional().nullable(),   // honoured only when an ADMIN registers for an existing login
});
export const searchQuery = z.object({ q: z.string().optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });

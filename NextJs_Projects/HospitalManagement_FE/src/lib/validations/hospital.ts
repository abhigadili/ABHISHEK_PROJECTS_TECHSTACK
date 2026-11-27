import { z } from 'zod';
import { email, pageQuery } from './common';

export const hospitalSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - and _ only').transform((v) => v.toUpperCase()),
  description: z.string().trim().max(2000).optional().default(''),
  address: z.string().trim().max(255).optional().default(''), city: z.string().trim().max(80).optional().default(''),
  phone: z.string().trim().refine((v) => v === '' || /^[+()\d\s-]{6,30}$/.test(v), 'Digits, spaces, + ( ) - only').optional().default(''), email: z.union([email, z.literal('')]).optional().default(''),
  facilities: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  operatingHours: z.string().trim().max(200).optional().default(''),
  parentId: z.coerce.number().int().positive().nullable().optional(),
  active: z.boolean().default(true),
});
export type HospitalInput = z.infer<typeof hospitalSchema>;
export type HospitalFormValues = z.input<typeof hospitalSchema>;
export const departmentSchema = z.object({ name: z.string().trim().min(2, 'Name is required').max(100), description: z.string().trim().max(255).optional().default('') });
export const hospitalQuery = pageQuery.extend({ city: z.string().max(80).optional() });

import { z } from 'zod';
import { email, optionalPhone, password, pageQuery } from './common';
import { ROLE_KEYS } from '@/lib/constants/rbac';

export const userCreateSchema = z.object({ email, firstName: z.string().trim().min(1, 'Required').max(80), lastName: z.string().trim().min(1, 'Required').max(80), phone: optionalPhone.default(''), role: z.enum(ROLE_KEYS, { message: 'Select a role' }), hospitalId: z.coerce.number().int().nonnegative().default(0), password })
  .superRefine((v, ctx) => { if (['HOSPITAL_ADMIN', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF', 'RECEPTIONIST'].includes(v.role) && !v.hospitalId) ctx.addIssue({ code: 'custom', path: ['hospitalId'], message: 'Hospital staff must be linked to a hospital' }); });
export type UserFormValues = z.input<typeof userCreateSchema>;
export const userUpdateSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(), role: z.enum(ROLE_KEYS).optional(), hospitalId: z.coerce.number().int().nonnegative().optional() });
export const userQuery = pageQuery.extend({ role: z.enum(ROLE_KEYS).optional(), status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional() });
export const rolePermissionSchema = z.object({ permissions: z.array(z.string()).max(200) });
export const notificationPrefSchema = z.object({ inApp: z.boolean(), email: z.boolean(), reminders: z.boolean() });

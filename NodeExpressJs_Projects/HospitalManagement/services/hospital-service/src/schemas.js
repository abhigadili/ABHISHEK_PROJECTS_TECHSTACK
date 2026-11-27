import { z } from 'zod';
import { ALL_ROLES } from '@hms/shared/constants';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
const password = z.string().min(8).max(72)
  .regex(/[A-Z]/, 'must contain an uppercase letter').regex(/[a-z]/, 'must contain a lowercase letter').regex(/\d/, 'must contain a digit');
const username = z.string().min(4).max(60).regex(/^[A-Za-z0-9._-]+$/, "only letters, digits, '.', '_' and '-' are allowed");

export const hospitalBody = z.object({
  name: z.string().trim().min(1).max(150), code: z.string().trim().min(1).max(30),
  address: z.string().max(255).optional(), city: z.string().max(80).optional(), phone: z.string().max(30).optional(), email: z.email().max(120).optional(),
});
export const departmentBody = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(255).optional() });
export const loginBody = z.object({ username: z.string().min(1), password: z.string().min(1) });
export const registerBody = z.object({ username, email: z.email().max(120), password });
export const createUserBody = z.object({ username, email: z.email().max(120), password, role: z.enum(ALL_ROLES) });
export const enabledBody = z.object({ enabled: z.boolean() });
export const refreshBody = z.object({ refreshToken: z.string().min(20) });
export const deptParams = z.object({ id: z.coerce.number().int().positive(), deptId: z.coerce.number().int().positive() });

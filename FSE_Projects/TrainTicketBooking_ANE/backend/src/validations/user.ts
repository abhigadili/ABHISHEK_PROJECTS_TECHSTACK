import { z } from 'zod';
import { pageQuery, mobile } from './common';
import { ROLE_KEYS } from '../constants/rbac';
export const userQuery = pageQuery.extend({ role: z.enum(ROLE_KEYS).optional(), status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional() });
export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']) });
export const userRolesSchema = z.object({ roles: z.array(z.enum(ROLE_KEYS)).min(1, 'Select at least one role') });
export const userUpdateSchema = z.object({ name: z.string().trim().min(2).max(120), mobile });

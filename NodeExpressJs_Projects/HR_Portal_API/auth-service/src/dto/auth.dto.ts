import { z, zEmail, zId } from '@hr/common';

/** Password policy: 10+ chars with upper, lower, digit and symbol. */
export const passwordSchema = z.string().min(10).max(100)
  .regex(/[a-z]/, 'must contain a lowercase letter').regex(/[A-Z]/, 'must contain an uppercase letter')
  .regex(/\d/, 'must contain a digit').regex(/[^A-Za-z0-9]/, 'must contain a symbol');

export const loginDto = z.object({ username: z.string().min(1).max(190), password: z.string().min(1).max(100) });
export const refreshDto = z.object({ refreshToken: z.string().min(20).max(200) });
export const logoutDto = z.object({ refreshToken: z.string().max(200).optional() });
export const changePasswordDto = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });
export const forgotPasswordDto = z.object({ email: zEmail });
export const resetPasswordDto = z.object({ token: z.string().min(20).max(200), newPassword: passwordSchema });

export const createUserDto = z.object({
  username: z.string().min(3).max(60).regex(/^[a-zA-Z0-9._-]+$/),
  email: zEmail,
  password: passwordSchema,
  employeeId: zId.optional(),
  roles: z.array(z.string()).min(1),
  mustChangePassword: z.boolean().default(true),
});
export const updateUserDto = z.object({ email: zEmail.optional() }).strict();
export const assignRolesDto = z.object({ roles: z.array(z.string()).min(1) });
export const linkEmployeeDto = z.object({ employeeId: zId.nullable() });
export const rolePermissionsDto = z.object({ permissions: z.array(z.string()) });
export const userListQuery = z.object({
  page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(), status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(),
  sort: z.string().optional(),
});

export const USER_FIELDS = ['id', 'username', 'email', 'employeeId', 'status', 'failedAttempts', 'lastLoginAt', 'lockedUntil', 'mustChangePassword', 'passwordChangedAt', 'createdAt', 'updatedAt'];

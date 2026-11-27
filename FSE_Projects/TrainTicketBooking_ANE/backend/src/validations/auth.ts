import { z } from 'zod';
import { email, mobile, password } from './common';
export const registerSchema = z.object({ name: z.string().trim().min(2, 'Name is required').max(120), email, mobile, password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20, 'Invalid reset link'), password, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Must differ from the current password' });
export const profileSchema = z.object({ name: z.string().trim().min(2).max(120), mobile });
export type RegisterInput = z.infer<typeof registerSchema>;

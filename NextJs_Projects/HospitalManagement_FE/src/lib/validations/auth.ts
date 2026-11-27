import { z } from 'zod';
import { email, isoDate, optionalPhone, password, phone } from './common';

export const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required') });
export const mfaVerifySchema = z.object({ code: z.string().trim().min(6, 'Enter the 6-digit code or a recovery code').max(20) });

/** Patient self-registration: nested objects (account / personal / emergency), cross-field + conditional rules. */
export const registerPatientSchema = z.object({
  account: z.object({ email, password, confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }),
  personal: z.object({
    firstName: z.string().trim().min(1, 'First name is required').max(80), lastName: z.string().trim().min(1, 'Last name is required').max(80),
    phone, dateOfBirth: isoDate.refine((d) => new Date(d) < new Date(), 'Date of birth must be in the past'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Select a gender' }), bloodGroup: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    address: z.string().trim().max(255), city: z.string().trim().max(80),
  }),
  emergency: z.object({ name: z.string().trim().max(120), phone: optionalPhone }).refine((v) => v.name === '' || v.phone !== '', { path: ['phone'], message: 'Phone is required when a contact name is given' }),
  acceptTerms: z.literal(true, { message: 'You must accept the terms' }),
});
export type RegisterPatientInput = z.infer<typeof registerPatientSchema>;

export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20), password, confirmPassword: z.string() }).refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, 'Required'), newPassword: password, confirmPassword: z.string() }).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' }).refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Must differ from the current password' });

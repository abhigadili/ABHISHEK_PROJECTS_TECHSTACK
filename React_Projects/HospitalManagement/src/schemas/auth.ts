import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

/** Mirrors the backend rule: 4-60 chars [A-Za-z0-9._-]; password 8-72 with upper, lower and digit. */
export const accountSchema = z
  .object({
    username: z.string().trim().min(4, 'At least 4 characters').max(60, 'At most 60 characters').regex(/^[A-Za-z0-9._-]+$/, 'Letters, digits, dot, underscore and hyphen only'),
    email: z.string().trim().max(120).email('Enter a valid e-mail address'),
    password: z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[a-z]/, 'Add a lowercase letter').regex(/\d/, 'Add a digit'),
    confirmPassword: z.string(),
  })
  // cross-field validation
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
export type AccountValues = z.infer<typeof accountSchema>;

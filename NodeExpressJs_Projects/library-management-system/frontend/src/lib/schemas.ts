import { z } from 'zod';

export const passwordRules = z.string().min(8, 'At least 8 characters').max(72, 'At most 72 characters')
  .regex(/[a-z]/, 'Needs a lowercase letter').regex(/[A-Z]/, 'Needs an uppercase letter').regex(/[0-9]/, 'Needs a digit');
export const phoneRule = z.string().trim().min(6, 'Phone number is required').max(30).regex(/^[0-9+()\-.\s]+$/, 'Digits, spaces and + ( ) - . only');
export const memberFields = {
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email address'),
  phone: phoneRule,
  dateOfBirth: z.string().optional().refine((v) => !v || new Date(v) < new Date(), 'Date of birth must be in the past'),
  gender: z.string().optional(),
  address: z.string().trim().min(3, 'Address is required').max(255),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().min(2, 'Country is required').max(80),
};

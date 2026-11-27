import { z } from 'zod';
import { isoDate, optionalPhone, phone, pageQuery } from './common';

export const patientProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80), lastName: z.string().trim().min(1, 'Last name is required').max(80),
  phone, dateOfBirth: isoDate.refine((d) => new Date(d) < new Date(), 'Must be in the past'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']), bloodGroup: z.enum(['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  address: z.string().trim().max(255).default(''), city: z.string().trim().max(80).default(''),
  emergencyContactName: z.string().trim().max(120).default(''), emergencyContactPhone: optionalPhone.default(''),
  medicalHistory: z.string().trim().max(4000).default(''),
}).refine((v) => v.emergencyContactName === '' || v.emergencyContactPhone !== '', { path: ['emergencyContactPhone'], message: 'Phone is required when a contact name is given' });
export type PatientProfileValues = z.input<typeof patientProfileSchema>;
export const patientQuery = pageQuery;

import { z } from 'zod';
import { isoDate, pageQuery } from './common';

export const bookAppointmentSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(), doctorId: z.coerce.number({ message: 'Select a doctor' }).int().positive('Select a doctor'),
  hospitalId: z.coerce.number({ message: 'Select a hospital' }).int().positive('Select a hospital'),
  startsAt: z.string().datetime({ message: 'Select a time slot' }), reason: z.string().trim().max(255).default(''),
});
export type BookAppointmentInput = z.input<typeof bookAppointmentSchema>;
export const rescheduleSchema = z.object({ startsAt: z.string().datetime({ message: 'Select a time slot' }) });
export const statusSchema = z.object({ status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']), reason: z.string().trim().max(255).default('') });
export const slotsQuery = z.object({ doctorId: z.coerce.number().int().positive(), hospitalId: z.coerce.number().int().positive(), date: isoDate });
export const appointmentQuery = pageQuery.extend({ status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(), from: isoDate.optional(), to: isoDate.optional(), doctorId: z.coerce.number().int().optional(), patientId: z.coerce.number().int().optional(), scope: z.enum(['upcoming', 'past']).optional() });

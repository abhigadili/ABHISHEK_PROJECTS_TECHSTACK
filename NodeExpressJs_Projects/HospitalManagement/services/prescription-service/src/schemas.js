import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const patientParams = z.object({ patientId: z.coerce.number().int().positive() });
export const doctorParams = z.object({ doctorId: z.coerce.number().int().positive() });
export const prescriptionBody = z.object({
  patientId: z.number().int().positive(), doctorId: z.number().int().positive(), appointmentId: z.number().int().positive().optional().nullable(),
  diagnosis: z.string().max(500).optional().nullable(), notes: z.string().max(1000).optional().nullable(), validDays: z.number().int().min(1).max(365).optional(),
  items: z.array(z.object({
    medicineName: z.string().trim().min(1).max(150), dosage: z.string().min(1).max(60), frequency: z.string().min(1).max(80),
    durationDays: z.number().int().min(1).max(365), quantity: z.number().int().min(1).max(1000), instructions: z.string().max(255).optional().nullable(),
  })).min(1, 'at least one medicine is required'),
});

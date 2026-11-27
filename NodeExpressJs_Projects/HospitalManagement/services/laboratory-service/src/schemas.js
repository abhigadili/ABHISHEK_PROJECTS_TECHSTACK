import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const patientParams = z.object({ patientId: z.coerce.number().int().positive() });
export const STATUSES = ['REQUESTED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const testBody = z.object({ code: z.string().trim().min(1).max(30), name: z.string().trim().min(1).max(150), sampleType: z.string().max(60).optional().nullable(), price: z.number().min(0).max(1000000), turnaroundHours: z.number().int().optional().nullable() });
export const requestBody = z.object({
  patientId: z.number().int().positive(), doctorId: z.number().int().positive(), appointmentId: z.number().int().positive().optional().nullable(),
  testCode: z.string().min(1), priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).optional(), clinicalNotes: z.string().max(500).optional().nullable(),
});
export const statusBody = z.object({ status: z.enum(STATUSES) });
export const reportBody = z.object({ resultSummary: z.string().min(1).max(1000), resultDetails: z.string().max(4000).optional().nullable(), referenceRange: z.string().max(200).optional().nullable(), abnormal: z.boolean().default(false) });
export const queueQuery = z.object({ status: z.enum(STATUSES).optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });

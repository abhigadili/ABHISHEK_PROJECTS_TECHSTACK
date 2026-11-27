import { z } from 'zod';
import { hhmm, isoDate, pageQuery } from './common';
export { hhmm };

export const recordSchema = z.object({
  patientId: z.coerce.number().int().positive(), appointmentId: z.coerce.number().int().positive().optional(),
  type: z.enum(['CONSULTATION', 'DIAGNOSIS', 'NOTE', 'ALLERGY', 'TREATMENT', 'HISTORY']), title: z.string().trim().min(2, 'Title is required').max(160),
  diagnosis: z.string().trim().max(255).default(''), notes: z.string().trim().max(8000).default(''),
}).superRefine((v, ctx) => { if (v.type === 'DIAGNOSIS' && !v.diagnosis) ctx.addIssue({ code: 'custom', path: ['diagnosis'], message: 'Diagnosis text is required for diagnosis entries' }); });
export type RecordFormValues = z.input<typeof recordSchema>;
export const recordQuery = pageQuery.extend({ type: z.enum(['CONSULTATION', 'DIAGNOSIS', 'NOTE', 'ALLERGY', 'TREATMENT', 'HISTORY']).optional() });

export const prescriptionItemSchema = z.object({
  medicineId: z.coerce.number({ message: 'Select a medicine' }).int().positive('Select a medicine'),
  dosage: z.string().trim().min(1, 'Dosage is required').max(60).regex(/^\d+(\.\d+)?\s?(mg|g|mcg|ml|iu|units?|tabs?|tablets?|caps?|capsules?|drops?|puffs?|%)$/i, 'e.g. 500mg or 5 ml'),
  frequency: z.string().trim().min(1, 'Frequency is required').max(60), durationDays: z.coerce.number().int().min(1, 'At least 1 day').max(365), quantity: z.coerce.number().int().min(1).max(1000), instructions: z.string().trim().max(255).default(''),
});
export const prescriptionSchema = z.object({
  patientId: z.coerce.number({ message: 'Select a patient' }).int().positive('Select a patient'), appointmentId: z.coerce.number().int().positive().optional(),
  diagnosis: z.string().trim().min(3, 'Enter the diagnosis').max(255), notes: z.string().trim().max(2000).default(''), validDays: z.coerce.number().int().min(1).max(365).default(30),
  items: z.array(prescriptionItemSchema).min(1, 'Add at least one medicine'),
}).superRefine((v, ctx) => { const seen = new Set<number>(); v.items.forEach((it, i) => { if (seen.has(it.medicineId)) ctx.addIssue({ code: 'custom', path: ['items', i, 'medicineId'], message: 'Medicine already added' }); seen.add(it.medicineId); }); });
export type PrescriptionFormValues = z.input<typeof prescriptionSchema>;

export const labTestSchema = z.object({ code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - _').transform((v) => v.toUpperCase()), name: z.string().trim().min(2).max(150), categoryId: z.coerce.number().int().positive('Select a category'), price: z.coerce.number().min(0).max(1_000_000), sampleType: z.string().trim().max(40).default(''), turnaroundHours: z.coerce.number().int().min(1).max(720).default(24) });
export const labRequestSchema = z.object({
  patientId: z.coerce.number().int().positive('Select a patient'), appointmentId: z.coerce.number().int().positive().optional(), hospitalId: z.coerce.number().int().positive('Select a hospital'),
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE'), clinicalNotes: z.string().trim().max(500).default(''), testIds: z.array(z.coerce.number().int().positive()).min(1, 'Select at least one test'),
}).superRefine((v, ctx) => { if (v.priority !== 'ROUTINE' && !v.clinicalNotes) ctx.addIssue({ code: 'custom', path: ['clinicalNotes'], message: 'Clinical notes are required for urgent/STAT requests' }); });
export type LabRequestFormValues = z.input<typeof labRequestSchema>;
export const labStatusSchema = z.object({ status: z.enum(['SAMPLE_COLLECTED', 'PROCESSING', 'CANCELLED']), scheduledAt: z.string().datetime().optional() });
export const labReportSchema = z.object({ resultSummary: z.string().trim().min(2, 'Summary is required').max(500), resultDetails: z.string().trim().max(8000).default(''), referenceRange: z.string().trim().max(120).default(''), abnormal: z.boolean().default(false), publish: z.boolean().default(true) });

export const medicineSchema = z.object({ name: z.string().trim().min(2).max(150), genericName: z.string().trim().max(150).default(''), sku: z.string().trim().min(2).max(40), categoryId: z.coerce.number().int().positive('Select a category'), unitPrice: z.coerce.number().min(0.01).max(100000), reorderLevel: z.coerce.number().int().min(0).max(100000).default(20) });
export const stockSchema = z.object({ medicineId: z.coerce.number().int().positive(), batchNumber: z.string().trim().min(1, 'Batch number is required').max(40), expiryDate: isoDate.refine((d) => new Date(d) > new Date(), 'Expiry must be in the future'), quantity: z.coerce.number().int().min(1, 'At least 1').max(1_000_000) });
export const adjustSchema = z.object({ delta: z.coerce.number().int().refine((n) => n !== 0, 'Cannot be zero'), reason: z.string().trim().min(3, 'Give a reason').max(160) });
export const dispenseSchema = z.object({ items: z.array(z.object({ itemId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(0) })).min(1) });

import { z } from 'zod';

/** Lab request form: one clinical context, N tests (dynamic rows). */
export const labRequestSchema = z
  .object({
    patientId: z.number({ message: 'Select a patient' }).int().positive('Select a patient'),
    doctorId: z.number({ message: 'Select the requesting doctor' }).int().positive('Select the requesting doctor'),
    appointmentId: z.number().int().positive().nullable().optional(),
    priority: z.enum(['ROUTINE', 'URGENT', 'STAT']),
    clinicalNotes: z.string().trim().max(500, 'At most 500 characters').optional(),
    tests: z.array(z.object({ testCode: z.string().min(1, 'Choose a test') })).min(1, 'Add at least one test'),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.tests.forEach((t, i) => {
      if (t.testCode && seen.has(t.testCode)) ctx.addIssue({ code: 'custom', path: ['tests', i, 'testCode'], message: 'This test is already selected' });
      seen.add(t.testCode);
    });
    // conditional: urgent/STAT orders need a clinical justification
    if (v.priority !== 'ROUTINE' && !(v.clinicalNotes ?? '').trim()) ctx.addIssue({ code: 'custom', path: ['clinicalNotes'], message: 'Add clinical notes for urgent or STAT requests' });
  });
export type LabRequestFormValues = z.infer<typeof labRequestSchema>;

export const labReportSchema = z.object({
  resultSummary: z.string().trim().min(1, 'Summary is required').max(1000),
  resultDetails: z.string().trim().max(4000).optional(),
  referenceRange: z.string().trim().max(200).optional(),
  abnormal: z.boolean(),
});
export type LabReportFormValues = z.infer<typeof labReportSchema>;

export const labTestSchema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(30).regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, - and _ only'),
  name: z.string().trim().min(1, 'Name is required').max(150),
  sampleType: z.string().trim().max(60).optional(),
  price: z.coerce.number({ message: 'Enter a price' }).min(0).max(1_000_000),
  turnaroundHours: z.union([z.literal(''), z.coerce.number().int().min(1).max(720)]).optional(),
});
export type LabTestFormValues = z.input<typeof labTestSchema>;

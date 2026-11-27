import { z } from 'zod';

export const FREQUENCIES = ['OD', 'BD', 'TID', 'QID', 'HS', 'SOS', 'Weekly'] as const;
const DOSAGE = /^\d+(\.\d+)?\s?(mg|g|mcg|µg|ml|l|iu|units?|tabs?|tablets?|caps?|capsules?|drops?|puffs?|%)(\s?\/\s?\w+)?$/i;

export const prescriptionItemSchema = z.object({
  medicineName: z.string().trim().min(1, 'Medicine name is required').max(150),
  dosage: z.string().trim().min(1, 'Dosage is required').max(60).regex(DOSAGE, 'Use a number and unit, e.g. 500mg or 5 ml'),
  frequency: z.string().trim().min(1, 'Frequency is required').max(80),
  durationDays: z.coerce.number({ message: 'Enter days' }).int('Whole days').min(1, 'At least 1 day').max(365, 'At most 365 days'),
  quantity: z.coerce.number({ message: 'Enter quantity' }).int('Whole units').min(1, 'At least 1').max(1000, 'At most 1000'),
  instructions: z.string().trim().max(255).optional().default(''),
});

export const prescriptionSchema = z
  .object({
    patientId: z.number({ message: 'Select a patient' }).int().positive('Select a patient'),
    doctorId: z.number({ message: 'Select the prescribing doctor' }).int().positive('Select the prescribing doctor'),
    appointmentId: z.number().int().positive().nullable().optional(),
    diagnosis: z.string().trim().min(3, 'Enter the diagnosis (at least 3 characters)').max(500),
    notes: z.string().trim().max(1000).optional().default(''),
    validDays: z.coerce.number({ message: 'Enter validity' }).int().min(1, 'At least 1 day').max(365, 'At most 365 days'),
    items: z.array(prescriptionItemSchema).min(1, 'Add at least one medicine'),
  })
  // cross-row rule: the same medicine twice in one prescription is almost always a mistake
  .superRefine((v, ctx) => {
    const seen = new Map<string, number>();
    v.items.forEach((it, i) => {
      const k = it.medicineName.trim().toLowerCase();
      if (!k) return;
      if (seen.has(k)) ctx.addIssue({ code: 'custom', path: ['items', i, 'medicineName'], message: `Already added in row ${(seen.get(k) ?? 0) + 1}` });
      else seen.set(k, i);
    });
  });

export type PrescriptionFormValues = z.input<typeof prescriptionSchema>;
export const emptyItem = { medicineName: '', dosage: '', frequency: 'OD', durationDays: 5, quantity: 5, instructions: '' };

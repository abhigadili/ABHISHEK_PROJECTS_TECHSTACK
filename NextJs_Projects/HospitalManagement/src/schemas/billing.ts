import { z } from 'zod';

/** Zod is used here only for the final payload check; the form itself is a useReducer form (see GenerateBillPage). */
export const billItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(200),
  quantity: z.number({ message: 'Enter a quantity' }).int('Whole units').min(1, 'At least 1').max(100000),
  unitPrice: z.number({ message: 'Enter a price' }).min(0.01, 'At least 0.01').max(100_000_000),
});
export const billSchema = z.object({
  patientId: z.number({ message: 'Select a patient' }).int().positive('Select a patient'),
  billType: z.enum(['APPOINTMENT', 'LAB', 'MEDICINE', 'OTHER']),
  referenceId: z.number().int().positive().nullable(),
  note: z.string().trim().max(255, 'At most 255 characters'),
  items: z.array(billItemSchema).min(1, 'Add at least one line item'),
});

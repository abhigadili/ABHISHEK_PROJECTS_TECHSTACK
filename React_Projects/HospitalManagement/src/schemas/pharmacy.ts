import { z } from 'zod';

export const medicineSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(40),
  name: z.string().trim().min(1, 'Name is required').max(150),
  genericName: z.string().trim().max(150).optional(),
  unitPrice: z.coerce.number({ message: 'Enter a price' }).min(0.01, 'At least 0.01').max(1_000_000),
  stockQuantity: z.coerce.number({ message: 'Enter stock' }).int('Whole units').min(0).max(10_000_000),
  reorderLevel: z.coerce.number({ message: 'Enter a level' }).int('Whole units').min(0).max(10_000_000),
});
export type MedicineFormValues = z.input<typeof medicineSchema>;

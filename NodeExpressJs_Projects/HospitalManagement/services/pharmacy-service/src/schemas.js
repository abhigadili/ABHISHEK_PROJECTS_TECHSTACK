import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const rxParams = z.object({ prescriptionId: z.coerce.number().int().positive() });
export const medicineBody = z.object({
  sku: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(150), genericName: z.string().max(150).optional().nullable(),
  unitPrice: z.number().min(0.01).max(1000000), stockQuantity: z.number().int().min(0).max(10000000), reorderLevel: z.number().int().min(0).max(10000000).optional(),
});
export const restockBody = z.object({ quantity: z.number().int().min(1).max(10000000) });
export const rejectBody = z.object({ reason: z.string().min(1).max(255) });
export const ordersQuery = z.object({ status: z.enum(['PENDING', 'DISPENSED', 'REJECTED']).optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });

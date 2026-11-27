import { z } from 'zod';

export const idParams = z.object({ id: z.coerce.number().int().positive() });
export const patientParams = z.object({ patientId: z.coerce.number().int().positive() });
export const refParams = z.object({ reference: z.string().min(5).max(40) });
export const BILL_TYPES = ['APPOINTMENT', 'LAB', 'MEDICINE', 'OTHER'];
export const billBody = z.object({
  patientId: z.number().int().positive(), billType: z.enum(BILL_TYPES), referenceId: z.number().int().positive().optional().nullable(), note: z.string().max(255).optional().nullable(),
  items: z.array(z.object({ description: z.string().min(1).max(200), quantity: z.number().int().min(1).max(100000), unitPrice: z.number().min(0.01).max(100000000) })).min(1, 'at least one item is required'),
});
/** Only the method is accepted - there is no field for card numbers, CVV or UPI PINs anywhere in this API. */
export const paymentBody = z.object({ method: z.enum(['CARD', 'UPI', 'NET_BANKING', 'CASH', 'INSURANCE']), simulateOutcome: z.enum(['SUCCESS', 'FAILURE']).optional() });
export const paymentStatusBody = z.object({ status: z.enum(['SUCCESS', 'FAILED']), failureReason: z.string().max(255).optional().nullable() });
export const listQuery = z.object({ status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(), page: z.coerce.number().int().min(0).default(0), size: z.coerce.number().int().min(1).max(100).default(20) });

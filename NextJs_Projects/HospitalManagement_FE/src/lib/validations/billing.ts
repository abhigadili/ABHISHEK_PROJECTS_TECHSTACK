import { z } from 'zod';
import { pageQuery } from './common';

export const invoiceItemSchema = z.object({ type: z.enum(['CONSULTATION', 'LABORATORY', 'MEDICINE', 'OTHER']), description: z.string().trim().min(1, 'Description is required').max(200), quantity: z.coerce.number().int().min(1, 'At least 1').max(10000), unitPrice: z.coerce.number().min(0.01, 'At least 0.01').max(1_000_000) });
export const invoiceSchema = z.object({
  patientId: z.coerce.number({ message: 'Select a patient' }).int().positive('Select a patient'), hospitalId: z.coerce.number().int().positive(), appointmentId: z.coerce.number().int().positive().optional(),
  discount: z.coerce.number().min(0).default(0), items: z.array(invoiceItemSchema).min(1, 'Add at least one item'),
}).superRefine((v, ctx) => { const sub = v.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0); if (v.discount > sub) ctx.addIssue({ code: 'custom', path: ['discount'], message: 'Discount cannot exceed the subtotal' }); });
export type InvoiceFormValues = z.input<typeof invoiceSchema>;

/** Payment information: ONLY the method and (for cards) the last four digits ever reach the server - never PAN/CVV. */
export const paymentSchema = z.object({
  amount: z.coerce.number().positive('Enter an amount').optional(),
  method: z.enum(['CARD', 'UPI', 'NET_BANKING', 'CASH']),
  cardLast4: z.string().regex(/^\d{4}$/, 'Last 4 digits only').optional(),
}).refine((v) => v.method !== 'CARD' || !!v.cardLast4, { path: ['cardLast4'], message: 'Card number is required for card payments' });
export const refundSchema = z.object({ amount: z.coerce.number().positive('Enter an amount'), reason: z.string().trim().min(3, 'Give a reason').max(200) });
export const invoiceQuery = pageQuery.extend({ status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED']).optional() });

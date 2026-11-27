'use server';
import { revalidatePath, updateTag } from 'next/cache';
import { z } from 'zod';
import { billingService } from '@/services/backend/billing';
import { authorize, failure, invalid, str, success, type ActionState } from '@/lib/actions/state';
import { billSchema } from '@/schemas/billing';
import { CACHE_TAGS } from '@/constants/cache';
import { emptyToNull } from '@/lib/utilities/format';
import type { Bill, Payment } from '@/types';

function bust(billId?: number) { updateTag(CACHE_TAGS.billing); revalidatePath('/billing'); revalidatePath('/billing/invoices'); revalidatePath('/billing/payments'); revalidatePath('/dashboard'); if (billId) revalidatePath(`/billing/invoices/${billId}`); }

export async function createBillAction(values: unknown): Promise<ActionState<Bill>> {
  const auth = await authorize('billing:manage');
  if ('denied' in auth) return auth.denied;
  const parsed = billSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  try { const b = await billingService.create({ ...parsed.data, note: emptyToNull(parsed.data.note) }); bust(b.id); return success(`Bill ${b.billNumber} generated`, b); } catch (e) { return failure(e); }
}

/** Scenario 6 - payment through the backend's simulated gateway: initiate (POST) then, when the method is not asynchronous, query the status (sequential calls). */
export async function payBillAction(_p: ActionState<Payment>, fd: FormData): Promise<ActionState<Payment>> {
  const auth = await authorize('billing:pay');
  if ('denied' in auth) return auth.denied;
  const parsed = z.object({ billId: z.coerce.number().int().positive(), method: z.enum(['CARD', 'UPI', 'NET_BANKING', 'CASH', 'INSURANCE'], { message: 'Choose a payment method' }), simulateOutcome: z.enum(['', 'SUCCESS', 'FAILURE']) }).safeParse({ billId: str(fd, 'billId'), method: str(fd, 'method'), simulateOutcome: str(fd, 'simulateOutcome') });
  if (!parsed.success) return invalid(parsed.error);
  try {
    const p = await billingService.pay(parsed.data.billId, { method: parsed.data.method, ...(parsed.data.simulateOutcome ? { simulateOutcome: parsed.data.simulateOutcome } : {}) });
    bust(parsed.data.billId);
    return success(p.status === 'SUCCESS' ? 'Payment successful' : p.status === 'FAILED' ? `Payment failed${p.failureReason ? `: ${p.failureReason}` : ''}` : `Payment ${p.transactionRef} is pending confirmation`, p);
  } catch (e) { return failure(e); }
}

export async function confirmPaymentAction(billId: number, ref: string, status: 'SUCCESS' | 'FAILED'): Promise<ActionState<Payment>> {
  const auth = await authorize('billing:manage');
  if ('denied' in auth) return auth.denied;
  try { const p = await billingService.setPaymentStatus(ref, { status, failureReason: status === 'FAILED' ? 'Declined by staff' : undefined }); bust(billId); return success(`Payment marked ${status.toLowerCase()}`, p); } catch (e) { return failure(e); }
}

export async function cancelBillAction(id: number): Promise<ActionState> {
  const auth = await authorize('billing:manage');
  if ('denied' in auth) return auth.denied;
  try { await billingService.cancel(id); bust(id); return success('Bill cancelled'); } catch (e) { return failure(e); }
}

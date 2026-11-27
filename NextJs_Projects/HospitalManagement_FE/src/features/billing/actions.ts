'use server';
import { revalidatePath } from 'next/cache';
import { billingService } from '@/server/services/billing.service';
import { run } from '@/server/http/action';
const bust = () => { for (const p of ['/billing', '/billing/invoices', '/billing/payments', '/patient/billing', '/patient/payments']) revalidatePath(p); revalidatePath('/patient/billing/[id]', 'page'); revalidatePath('/billing/invoices/[id]', 'page'); };
export async function createInvoiceAction(values: unknown) { const r = await run((p) => billingService.create(p, values), 'Invoice created'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors, data: r.ok ? { id: r.data!.id } : undefined }; }
/** Scenario 6: demo gateway payment. Only method + card LAST FOUR digits are accepted. */
export async function payInvoiceAction(id: number, values: unknown) { const r = await run((p) => billingService.pay(p, id, values), 'Payment processed'); if (r.ok) bust(); return { ok: r.ok && r.data?.status === 'SUCCEEDED', message: r.ok ? (r.data!.status === 'SUCCEEDED' ? `Payment successful - reference ${r.data!.reference}` : r.data!.failureReason ?? 'Payment failed') : r.message, fieldErrors: r.fieldErrors }; }
export async function refundPaymentAction(paymentId: number, values: unknown) { const r = await run((p) => billingService.refund(p, paymentId, values), 'Refund recorded'); if (r.ok) bust(); return { ok: r.ok, message: r.message, fieldErrors: r.fieldErrors }; }
export async function cancelInvoiceAction(id: number) { const r = await run((p) => billingService.cancel(p, id), 'Invoice cancelled'); if (r.ok) bust(); return { ok: r.ok, message: r.message }; }

import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import type { Bill, BillInput, BillStatus, Page, Payment, PaymentInitiateRequest } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
/** Billing data is financial + personal => dynamic, never cached. */
export const billingService = {
  list: (p: { status?: BillStatus; page?: number; size?: number } = {}) => backendFetch<Page<Bill>>('/api/bills', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  byPatient: (patientId: number) => backendFetch<Bill[]>(`/api/bills/patient/${patientId}`, { cache: 'no-store' }),
  get: (id: number) => backendFetch<Bill>(`/api/bills/${id}`, { cache: 'no-store' }),
  create: (b: BillInput) => backendFetch<Bill>('/api/bills', { method: 'POST', body: b, ...A }),
  cancel: (id: number) => backendFetch<Bill>(`/api/bills/${id}/cancel`, { method: 'PUT', ...A }),
  payments: (billId: number) => backendFetch<Payment[]>(`/api/bills/${billId}/payments`, { cache: 'no-store' }),
  pay: (billId: number, b: PaymentInitiateRequest) => backendFetch<Payment>(`/api/bills/${billId}/payments`, { method: 'POST', body: b, ...A }),
  setPaymentStatus: (ref: string, b: { status: 'SUCCESS' | 'FAILED'; failureReason?: string }) => backendFetch<Payment>(`/api/payments/${ref}/status`, { method: 'PUT', body: b, ...A }),
};

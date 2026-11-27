import { http } from '@/services/api/http';
import type { Bill, BillInput, BillStatus, Page, Payment, PaymentInitiateRequest } from '@/types';

export interface BillListParams {
  status?: BillStatus;
  page?: number;
  size?: number;
}

export const billingApi = {
  list: (params: BillListParams, signal?: AbortSignal) => http.get<Page<Bill>>('/bills', { ...params }, signal),
  forPatient: (patientId: number, signal?: AbortSignal) => http.get<Bill[]>(`/bills/patient/${patientId}`, undefined, signal),
  get: (id: number, signal?: AbortSignal) => http.get<Bill>(`/bills/${id}`, undefined, signal),
  create: (body: BillInput) => http.post<Bill>('/bills', body),
  cancel: (id: number) => http.put<Bill>(`/bills/${id}/cancel`),
  payments: (billId: number, signal?: AbortSignal) => http.get<Payment[]>(`/bills/${billId}/payments`, undefined, signal),
  pay: (billId: number, body: PaymentInitiateRequest) => http.post<Payment>(`/bills/${billId}/payments`, body),
  payment: (transactionRef: string, signal?: AbortSignal) => http.get<Payment>(`/payments/${transactionRef}`, undefined, signal),
  setPaymentStatus: (transactionRef: string, status: 'SUCCESS' | 'FAILED', failureReason?: string) =>
    http.put<Payment>(`/payments/${transactionRef}/status`, { status, failureReason }),
};

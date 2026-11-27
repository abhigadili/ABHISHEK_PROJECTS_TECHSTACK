import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi, type BillListParams } from '@/services/endpoints/billingApi';
import { queryKeys } from '@/services/queryKeys';
import { mutationKeys } from '@/app/queryClient';
import type { Bill, BillInput, BillStatus, PaymentInitiateRequest } from '@/types';

export function useBillPage(params: BillListParams, enabled = true) {
  return useQuery({ queryKey: queryKeys.billing.list(params), queryFn: ({ signal }) => billingApi.list(params, signal), placeholderData: keepPreviousData, enabled, meta: { errorMessage: 'Could not load invoices' } });
}

export function usePatientBills(patientId: number) {
  return useQuery({ queryKey: queryKeys.billing.forPatient(patientId), queryFn: ({ signal }) => billingApi.forPatient(patientId, signal), enabled: patientId > 0, meta: { errorMessage: 'Could not load invoices' } });
}

export function useBill(id: number) {
  const qc = useQueryClient();
  return useQuery<Bill>({
    queryKey: queryKeys.billing.detail(id),
    queryFn: ({ signal }) => billingApi.get(id, signal),
    enabled: id > 0,
    initialData: () => {
      for (const [, v] of qc.getQueriesData<Bill[] | { content: Bill[] }>({ queryKey: queryKeys.billing.all })) {
        const list = Array.isArray(v) ? v : v?.content;
        const hit = Array.isArray(list) ? list.find((b) => b.id === id) : undefined;
        if (hit && 'items' in hit) return hit;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => qc.getQueryState(queryKeys.billing.all)?.dataUpdatedAt,
  });
}

export function useBillPayments(billId: number) {
  return useQuery({ queryKey: queryKeys.billing.payments(billId), queryFn: ({ signal }) => billingApi.payments(billId, signal), enabled: billId > 0 });
}

/** Payments of many bills in parallel (dynamic useQueries) - payment history across a patient's invoices. */
export function useManyBillPayments(billIds: number[]) {
  return useQueries({ queries: billIds.map((id) => ({ queryKey: queryKeys.billing.payments(id), queryFn: ({ signal }: { signal: AbortSignal }) => billingApi.payments(id, signal) })) });
}

const STATUSES: BillStatus[] = ['PENDING', 'OVERDUE', 'PAID', 'CANCELLED'];

/**
 * Parallel API calls: four status queries run at the same time (useQueries). `combine` folds the results into one
 * summary object so the dashboard re-renders only when the folded value changes.
 */
export function useBillingStatusCounts(enabled: boolean) {
  return useQueries({
    queries: STATUSES.map((status) => ({ queryKey: queryKeys.billing.list({ status, page: 0, size: 100 }), queryFn: ({ signal }: { signal: AbortSignal }) => billingApi.list({ status, page: 0, size: 100 }, signal), enabled, staleTime: 20_000 })),
    combine: (results) => {
      const by = Object.fromEntries(STATUSES.map((s, i) => [s, results[i]!])) as Record<BillStatus, (typeof results)[number]>;
      const sum = (s: BillStatus, f: (b: Bill) => number) => (by[s].data?.content ?? []).reduce((a, b) => a + f(b), 0);
      return {
        isPending: results.some((r) => r.isPending),
        isError: results.some((r) => r.isError),
        error: results.find((r) => r.isError)?.error,
        counts: Object.fromEntries(STATUSES.map((s) => [s, by[s].data?.totalElements ?? 0])) as Record<BillStatus, number>,
        outstanding: sum('PENDING', (b) => b.totalAmount - b.paidAmount) + sum('OVERDUE', (b) => b.totalAmount - b.paidAmount),
        collected: sum('PAID', (b) => b.paidAmount),
        overdueAmount: sum('OVERDUE', (b) => b.totalAmount - b.paidAmount),
        truncated: STATUSES.some((s) => (by[s].data?.totalElements ?? 0) > 100),
        refetch: () => results.forEach((r) => void r.refetch()),
      };
    },
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: BillInput) => billingApi.create(b),
    meta: { silent: true },
    onSuccess: (bill) => {
      qc.setQueryData(queryKeys.billing.detail(bill.id), bill);
      void qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useCancelBill() {
  return useMutation<Bill, Error, number>({ mutationKey: mutationKeys.cancelBill });
}

/** Payment initiation with an OPTIMISTIC update: the invoice immediately shows a pending payment, rolled back on error. */
export function usePayBill(billId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: PaymentInitiateRequest) => billingApi.pay(billId, b),
    meta: { silent: true },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.billing.detail(billId) });
      const prev = qc.getQueryData<Bill>(queryKeys.billing.detail(billId));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKeys.billing.detail(billId), ctx.prev),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useConfirmPayment(billId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ref, status, reason }: { ref: string; status: 'SUCCESS' | 'FAILED'; reason?: string }) => billingApi.setPaymentStatus(ref, status, reason),
    meta: { errorMessage: 'Could not update payment' },
    onSuccess: (p) => {
      toastIf(p.status);
      void qc.invalidateQueries({ queryKey: queryKeys.billing.payments(billId) });
      void qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      void qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all }), 2500);
    },
  });
}

import toast from 'react-hot-toast';
function toastIf(status: string) {
  toast[status === 'SUCCESS' ? 'success' : 'error'](status === 'SUCCESS' ? 'Payment confirmed - invoice paid' : 'Payment marked as failed');
}

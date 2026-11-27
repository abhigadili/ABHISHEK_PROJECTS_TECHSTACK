import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyApi } from '@/services/endpoints/pharmacyApi';
import { queryKeys } from '@/services/queryKeys';
import type { Medicine, MedicineInput, Page, PharmacyOrder, PharmacyOrderStatus } from '@/types';

/** Whole catalogue (the endpoint is not paged). Cached for 2 min: pages that only need one medicine reuse it via `select`. */
export function useMedicines() {
  return useQuery({ queryKey: queryKeys.pharmacy.medicines(), queryFn: ({ signal }) => pharmacyApi.medicines(signal), staleTime: 2 * 60_000, gcTime: 15 * 60_000, meta: { errorMessage: 'Could not load medicines' } });
}

/** `select` transformation: derive one medicine from the cached list - no extra request, re-renders only when that row changes. */
export function useMedicine(id: number) {
  return useQuery({ queryKey: queryKeys.pharmacy.medicines(), queryFn: ({ signal }) => pharmacyApi.medicines(signal), staleTime: 2 * 60_000, select: (list: Medicine[]) => list.find((m) => m.id === id) ?? null });
}

export function useOrdersInfinite(status?: PharmacyOrderStatus, size = 8) {
  return useInfiniteQuery({
    queryKey: queryKeys.pharmacy.ordersInfinite(status),
    queryFn: ({ pageParam, signal }) => pharmacyApi.orders({ status, page: pageParam, size }, signal),
    initialPageParam: 0,
    getNextPageParam: (last: Page<PharmacyOrder>) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
    meta: { errorMessage: 'Could not load pharmacy orders' },
  });
}

export function useSaveMedicine(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: MedicineInput) => (id ? pharmacyApi.updateMedicine(id, b) : pharmacyApi.createMedicine(b)),
    meta: { silent: true },
    onSuccess: (m) => {
      // Cache update: patch/insert the row in the cached list instead of refetching everything
      qc.setQueryData<Medicine[]>(queryKeys.pharmacy.medicines(), (old) => (old ? (old.some((x) => x.id === m.id) ? old.map((x) => (x.id === m.id ? m : x)) : [...old, m]) : old));
      void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.medicines(), refetchType: 'none' });
    },
  });
}

/** Optimistic restock: the stock number changes immediately, rolls back if the request fails. */
export function useRestock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: number; quantity: number }) => pharmacyApi.restock(id, quantity),
    meta: { successMessage: 'Stock updated', errorMessage: 'Restock failed' },
    onMutate: async ({ id, quantity }) => {
      await qc.cancelQueries({ queryKey: queryKeys.pharmacy.medicines() });
      const prev = qc.getQueryData<Medicine[]>(queryKeys.pharmacy.medicines());
      qc.setQueryData<Medicine[]>(queryKeys.pharmacy.medicines(), (old) => old?.map((m) => (m.id === id ? { ...m, stockQuantity: m.stockQuantity + quantity } : m)));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKeys.pharmacy.medicines(), ctx.prev),
    onSettled: () => void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.medicines() }),
  });
}

export function useDispatchOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => pharmacyApi.dispense(id),
    meta: { successMessage: 'Order dispensed', errorMessage: 'Could not dispense' },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.all });
      void qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all });
      void qc.invalidateQueries({ queryKey: queryKeys.billing.all });
      setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.billing.all }), 2500); // medicine bill is created by Kafka
    },
  });
}

export function useRejectOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => pharmacyApi.reject(id, reason),
    meta: { successMessage: 'Order rejected', errorMessage: 'Could not reject order' },
    onSettled: () => { void qc.invalidateQueries({ queryKey: queryKeys.pharmacy.all }); void qc.invalidateQueries({ queryKey: queryKeys.prescriptions.all }); },
  });
}

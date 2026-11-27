import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { toApiError, errorMessage, isAbortError } from '@/services/axios/errors';
import { queryKeys } from '@/services/queryKeys';
import { appointmentApi } from '@/services/endpoints/appointmentApi';
import { billingApi } from '@/services/endpoints/billingApi';

/** Queries may opt in to a global error toast with `meta: { errorMessage: 'Could not load doctors' }`. */
declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { errorMessage?: string; silent?: boolean };
    mutationMeta: { successMessage?: string; errorMessage?: string; silent?: boolean };
  }
}

/** Retry policy: never retry client errors (400-499), retry network/5xx up to 2 times. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isAbortError(error)) return false;
  const err = toApiError(error);
  if (err.isClientError) return false;
  return failureCount < 2;
}

/** Exponential back-off with a 10 s ceiling. */
export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000);

/** Query Cache: global handler for failed queries (error handling). Background refetch failures only toast when data was already shown. */
const queryCache = new QueryCache({
  onError: (error, query) => {
    if (isAbortError(error) || query.meta?.silent) return;
    const err = toApiError(error);
    if (err.isUnauthorized) return; // handled by the session-expired flow
    if (query.meta?.errorMessage && (query.state.data === undefined || err.isNetworkError)) toast.error(`${query.meta.errorMessage}: ${errorMessage(err)}`, { id: `q-${query.queryHash}` });
  },
});

/** Mutation Cache: global success/error toasts driven by mutation meta (mutation lifecycle). */
const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    if (mutation.meta?.silent) return;
    toast.error(mutation.meta?.errorMessage ? `${mutation.meta.errorMessage}: ${errorMessage(error)}` : errorMessage(error));
  },
  onSuccess: (_data, _vars, _ctx, mutation) => {
    if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage);
  },
});

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000, // data is "fresh" for 30 s - no refetch on remount inside that window
      gcTime: 5 * 60_000, // unused cache entries are garbage collected after 5 min (formerly cacheTime)
      retry: shouldRetry,
      retryDelay,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      networkMode: 'online',
    },
    mutations: { retry: 0, networkMode: 'online' },
  },
});

/**
 * Query Defaults: per-key-prefix overrides (the closest match wins).
 *  - reference data that rarely changes: long staleTime and `offlineFirst` so cached lists keep working offline
 *  - volatile operational data (availability/slots): always revalidate quickly
 */
queryClient.setQueryDefaults(queryKeys.hospitals.all, { staleTime: 10 * 60_000, gcTime: 30 * 60_000, networkMode: 'offlineFirst' });
queryClient.setQueryDefaults(queryKeys.doctors.specializations(), { staleTime: 10 * 60_000, networkMode: 'offlineFirst' });
queryClient.setQueryDefaults(queryKeys.laboratory.tests(), { staleTime: 10 * 60_000, networkMode: 'offlineFirst' });
queryClient.setQueryDefaults([...queryKeys.appointments.all, 'availability'], { staleTime: 5_000, refetchOnWindowFocus: 'always' });
queryClient.setQueryDefaults([...queryKeys.doctors.all, 'slots'], { staleTime: 5_000, refetchOnWindowFocus: 'always' });
queryClient.setQueryDefaults(queryKeys.notifications.all, { staleTime: 15_000 });

/**
 * Mutation Defaults: a mutation key registers its mutationFn + lifecycle once; components call
 * `useMutation({ mutationKey })` and only add what is specific to them. Cancelling an appointment is optimistic:
 * the cached lists are patched in onMutate, rolled back in onError and revalidated in onSettled.
 */
export const mutationKeys = {
  cancelAppointment: ['appointments', 'cancel'] as const,
  cancelBill: ['billing', 'cancel'] as const,
};

import type { Appointment } from '@/types';
queryClient.setMutationDefaults(mutationKeys.cancelAppointment, {
  mutationFn: ({ id, reason }: { id: number; reason?: string }) => appointmentApi.cancel(id, reason),
  onMutate: async ({ id }: { id: number; reason?: string }) => {
    // Query cancellation: stop in-flight refetches so they cannot overwrite the optimistic value.
    await queryClient.cancelQueries({ queryKey: queryKeys.appointments.all });
    const snapshot = queryClient.getQueriesData<Appointment[]>({ queryKey: queryKeys.appointments.lists() });
    const detailKey = queryKeys.appointments.detail(id);
    const detailBefore = queryClient.getQueryData<Appointment>(detailKey);
    const patch = (a: Appointment): Appointment => (a.id === id ? { ...a, status: 'CANCELLED' } : a);
    // Cache updates: patch every cached list that contains the appointment + the detail entry.
    queryClient.setQueriesData<Appointment[]>({ queryKey: queryKeys.appointments.lists() }, (old) => old?.map(patch));
    if (detailBefore) queryClient.setQueryData<Appointment>(detailKey, patch(detailBefore));
    return { snapshot, detailBefore, detailKey };
  },
  onError: (_e, _v, ctx) => {
    const c = ctx as { snapshot: Array<[readonly unknown[], Appointment[] | undefined]>; detailBefore?: Appointment; detailKey: readonly unknown[] } | undefined;
    c?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    if (c?.detailBefore) queryClient.setQueryData(c.detailKey, c.detailBefore);
  },
  onSuccess: () => {
    toast.success('Appointment cancelled');
  },
  onSettled: () => {
    // Query invalidation: availability changes (slot is free again) and the bill is cancelled by a Kafka consumer.
    void queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  },
});

queryClient.setMutationDefaults(mutationKeys.cancelBill, {
  mutationFn: (id: number) => billingApi.cancel(id),
  onSuccess: () => toast.success('Invoice cancelled'),
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  },
});

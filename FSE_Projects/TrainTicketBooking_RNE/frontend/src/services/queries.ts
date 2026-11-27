import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, patch, post, put } from './api';
import type { Booking, CancellationQuote, NotificationItem, Payment, Refund, SavedPassenger, SearchResult, SeatMap, Stats, Station, Paged } from '@/types';

import { catalogApi } from '@/store/api';
import { store } from '@/store';
/** RTK Query bell must refresh too after payments / cancellations */
const dispatchNotifRefresh = () => store.dispatch(catalogApi.util.invalidateTags(['Notification']));
/** Query-key factory: one place so invalidation is precise */
export const qk = {
  search: (p: object) => ['search', p] as const, seatMap: (p: object) => ['seatMap', p] as const,
  bookings: (p: object) => ['bookings', p] as const, booking: (id: number | string) => ['booking', String(id)] as const, pnr: (p: string) => ['pnr', p] as const,
  quote: (id: number) => ['quote', id] as const, payments: (p: object) => ['payments', p] as const, refunds: (p: object) => ['refunds', p] as const,
  passengers: () => ['passengers'] as const, notifications: () => ['notifications'] as const, stats: () => ['stats'] as const, admin: (n: string, p?: object) => ['admin', n, p ?? {}] as const,
};
const page = async <T>(url: string, params?: object): Promise<Paged<T>> => { const r = await get<T[]>(url, params); return { data: r.data, meta: r.meta! }; };

export const useSearch = (p: { from: string; to: string; date: string; sort: string; type?: string; coachTypeId?: string; departAfter?: string } | null) =>
  useQuery({ queryKey: qk.search(p ?? {}), enabled: !!p, queryFn: async () => (await get<SearchResult[]>('/trains/search', Object.fromEntries(Object.entries(p!).filter(([, v]) => v)))).data, placeholderData: keepPreviousData });
export const useSeatMap = (p: { trainId: number; from: number; to: number; date: string; coachTypeId: number } | null) =>
  useQuery({ queryKey: qk.seatMap(p ?? {}), enabled: !!p, queryFn: async () => (await get<SeatMap>('/seats/availability', p!)).data, refetchInterval: 20_000 });
export const useBookings = (params: object) => useQuery({ queryKey: qk.bookings(params), queryFn: () => page<Booking>('/bookings', params), placeholderData: keepPreviousData });
export const useBooking = (id?: string | number) => useQuery({ queryKey: qk.booking(id ?? 0), enabled: !!id, queryFn: async () => (await get<Booking>(`/bookings/${id}`)).data });
export const useQuote = (id: number, enabled: boolean) => useQuery({ queryKey: qk.quote(id), enabled, queryFn: async () => (await get<CancellationQuote>(`/bookings/${id}/cancellation-quote`)).data, staleTime: 0 });
export const usePayments = (params: object) => useQuery({ queryKey: qk.payments(params), queryFn: () => page<Payment>('/payments', params), placeholderData: keepPreviousData });
export const useRefunds = (params: object) => useQuery({ queryKey: qk.refunds(params), queryFn: () => page<Refund>('/refunds', params), placeholderData: keepPreviousData });
export const useSavedPassengers = () => useQuery({ queryKey: qk.passengers(), queryFn: async () => (await get<SavedPassenger[]>('/passengers', { size: 50 })).data });
export const useStats = () => useQuery({ queryKey: qk.stats(), queryFn: async () => (await get<Stats>('/admin/stats')).data, refetchInterval: 60_000 });
/** Infinite query: "load more" notifications */
export const useNotificationFeed = () => useInfiniteQuery({
  queryKey: qk.notifications(), initialPageParam: 0,
  queryFn: async ({ pageParam }): Promise<Paged<NotificationItem>> => { const r = await get<{ items: NotificationItem[] }>('/notifications', { page: pageParam, size: 10 }); return { data: r.data.items, meta: r.meta! }; },
  getNextPageParam: (last) => (last.meta.page + 1 < last.meta.totalPages ? last.meta.page + 1 : undefined),
});
/** Generic admin list (paged) */
export const useAdminList = <T,>(name: string, url: string, params: object) => useQuery({ queryKey: qk.admin(name, params), queryFn: () => page<T>(url, params), placeholderData: keepPreviousData });
export const useStationOptions = () => useQuery({ queryKey: ['station-options'], queryFn: async () => (await get<Station[]>('/stations', { size: 100 })).data, staleTime: 300_000 });

// ---- mutations
export const useCreateBooking = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (b: object) => post<Booking>('/bookings', b), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['seatMap'] }); } }); };
export const usePay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { bookingId: number; method: string; cardLast4?: string; outcome: 'SUCCESS' | 'FAILURE' }) => {
      const p = await post<Payment>('/payments', { bookingId: v.bookingId, method: v.method, cardLast4: v.cardLast4 });
      return post<Payment>(`/payments/${p.id}/confirm`, { outcome: v.outcome });
    },
    onSettled: (_d, _e, v) => { qc.invalidateQueries({ queryKey: qk.booking(v.bookingId) }); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: qk.notifications() }); qc.invalidateQueries({ queryKey: ['seatMap'] }); dispatchNotifRefresh(); },
  });
};
export const useCancelBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; passengerIds?: number[]; reason?: string }) => post<Booking>(`/bookings/${v.id}/cancel`, { passengerIds: v.passengerIds, reason: v.reason }),
    onSuccess: (_d, v) => { dispatchNotifRefresh(); qc.invalidateQueries({ queryKey: qk.notifications() }); qc.invalidateQueries({ queryKey: qk.booking(v.id) }); qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['refunds'] }); qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['seatMap'] }); qc.invalidateQueries({ queryKey: qk.quote(v.id) }); },
  });
};
/** Optimistic update: mark one notification read instantly, roll back on error */
export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => patch(`/notifications/${id}/read`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notifications() }); const prev = qc.getQueryData(qk.notifications());
      qc.setQueryData(qk.notifications(), (old: { pages: Paged<NotificationItem>[]; pageParams: unknown[] } | undefined) => old && { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)) })) });
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(qk.notifications(), ctx.prev); },
    onSettled: () => { qc.invalidateQueries({ queryKey: qk.notifications() }); dispatchNotifRefresh(); },
  });
};
/** Optimistic: remove a saved passenger from the list immediately */
export const useDeletePassenger = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => del(`/passengers/${id}`),
    onMutate: async (id) => { await qc.cancelQueries({ queryKey: qk.passengers() }); const prev = qc.getQueryData<SavedPassenger[]>(qk.passengers()); qc.setQueryData<SavedPassenger[]>(qk.passengers(), (o) => o?.filter((p) => p.id !== id)); return { prev }; },
    onError: (_e, _id, ctx) => ctx?.prev && qc.setQueryData(qk.passengers(), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.passengers() }),
  });
};
export const useSavePassenger = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (v: { id?: number; body: object }) => (v.id ? put(`/passengers/${v.id}`, v.body) : post('/passengers', v.body)), onSuccess: () => qc.invalidateQueries({ queryKey: qk.passengers() }) }); };
/** Generic admin save/delete with list invalidation */
export const useAdminMutation = (name: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ method, url, body }: { method: 'post' | 'put' | 'patch' | 'delete'; url: string; body?: unknown }) => (method === 'delete' ? del(url) : method === 'post' ? post(url, body) : method === 'put' ? put(url, body) : patch(url, body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', name] }); qc.invalidateQueries({ queryKey: ['station-options'] }); qc.invalidateQueries({ queryKey: qk.stats() }); },
  });
};

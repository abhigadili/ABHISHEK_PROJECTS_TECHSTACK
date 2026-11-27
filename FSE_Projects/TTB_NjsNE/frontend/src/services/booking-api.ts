import type { Booking, CancellationQuote, NotificationItem, Paged, Payment, Refund, SavedPassenger, Stats, User } from '@/types';
import { del, get, patch, post, put } from './api-client';
const page = async <T>(url: string, params?: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<Paged<T>> => { const r = await get<T[]>(url, params, signal); return { data: r.data, meta: r.meta! }; };
export const bookingApi = {
  list: (params: Record<string, string | number | undefined>) => page<Booking>('/bookings', params),
  one: async (id: number | string) => (await get<Booking>(`/bookings/${id}`)).data,
  byPnr: async (pnr: string, signal?: AbortSignal) => (await get<Booking>(`/bookings/pnr/${pnr}`, undefined, signal)).data,
  quote: async (id: number) => (await get<CancellationQuote>(`/bookings/${id}/cancellation-quote`)).data,
  cancel: (id: number, b: { passengerIds?: number[]; reason?: string }) => post<Booking>(`/bookings/${id}/cancel`, b),
};
export const paymentApi = {
  list: (params: Record<string, string | number | undefined>) => page<Payment>('/payments', params),
  /** Backend flow: POST /payments (initiate) then POST /payments/:id/confirm (simulated gateway outcome). */
  pay: async (v: { bookingId: number; method: string; cardLast4?: string; outcome: 'SUCCESS' | 'FAILURE' }) => {
    const p = await post<Payment>('/payments', { bookingId: v.bookingId, method: v.method, cardLast4: v.cardLast4 });
    return post<Payment>(`/payments/${p.id}/confirm`, { outcome: v.outcome });
  },
  receipt: async (id: number) => (await get<unknown>(`/payments/${id}/receipt`)).data,
};
export const refundApi = { list: (params: Record<string, string | number | undefined>) => page<Refund>('/refunds', params) };
export const passengerApi = {
  list: async () => (await get<SavedPassenger[]>('/passengers', { size: 50 })).data,
  save: (id: number | undefined, body: unknown) => (id ? put(`/passengers/${id}`, body) : post('/passengers', body)), remove: (id: number) => del(`/passengers/${id}`),
};
export const notificationApi = {
  feed: async (pageNo: number, size = 10, signal?: AbortSignal): Promise<Paged<NotificationItem>> => { const r = await get<{ items: NotificationItem[] }>('/notifications', { page: pageNo, size }, signal); return { data: r.data.items, meta: r.meta! }; },
  summary: async () => (await get<{ items: NotificationItem[]; unread: number }>('/notifications', { size: 8 })).data,
  markRead: (id: number) => patch(`/notifications/${id}/read`), markAllRead: () => patch('/notifications/read-all'),
};
export const adminApi = {
  stats: async () => (await get<Stats>('/admin/stats')).data,
  users: (params: Record<string, string | number | undefined>) => page<User>('/users', params),
  setUserStatus: (id: number, status: string) => patch(`/users/${id}/status`, { status }), setUserRoles: (id: number, roles: string[]) => put(`/users/${id}/roles`, { roles }),
  rules: async () => (await get<{ minHoursBefore: number; chargePercent: number | string; label: string }[]>('/cancellations/rules')).data,
  setRules: (rules: unknown) => put('/cancellations/rules', { rules }),
};
export const authApi = { // session endpoints are Next route handlers (cookie authority), not the BFF proxy
  me: async () => (await (await fetch('/api/session', { cache: 'no-store' })).json()) as { user: User | null },
};

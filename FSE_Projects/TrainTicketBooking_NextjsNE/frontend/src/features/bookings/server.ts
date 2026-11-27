import 'server-only';
import { backend } from '@/lib/server/backend';
import type { Booking, NotificationItem, Payment, Refund, SavedPassenger, Stats } from '@/types';

/** Everything below is per-user and therefore always `no-store` (enforced inside `backend()` for authenticated calls). */
export const getBookings = (params: { page?: number; size?: number; scope?: string; status?: string; q?: string }) => backend<Booking[]>('/bookings', { params });
export const getBooking = async (id: number | string) => (await backend<Booking>(`/bookings/${id}`)).data;
export const getBookingByPnr = async (pnr: string) => (await backend<Booking>(`/bookings/pnr/${pnr}`)).data;
export const getPayments = (params: { page?: number; size?: number }) => backend<Payment[]>('/payments', { params });
export const getRefunds = (params: { page?: number; size?: number }) => backend<Refund[]>('/refunds', { params });
export const getPassengers = async () => (await backend<SavedPassenger[]>('/passengers', { params: { size: 50 } })).data;
export const getNotifications = async (page = 0, size = 10) => { const r = await backend<{ items: NotificationItem[]; unread: number }>('/notifications', { params: { page, size } }); return { ...r.data, meta: r.meta! }; };
export const getStats = async () => (await backend<Stats>('/admin/stats')).data;
export const getCancellationRules = async () => (await backend<{ minHoursBefore: number; chargePercent: number | string; label: string }[]>('/cancellations/rules')).data;

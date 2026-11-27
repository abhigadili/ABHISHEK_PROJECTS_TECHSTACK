import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { Booking, BookingPayload, CancellationQuote, CancellationRow, CancellationRule, NotificationPage, NotificationPrefs, PageQuery, Payment, PaymentMethod, Receipt, Refund, RoleKey, SavedPassenger, Stats, User } from '../models/models';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.getPaged<User>('/users', { params: q }); }
  get(id: number) { return this.api.get<User>(`/users/${id}`); }
  update(id: number, b: { name: string; mobile: string }) { return this.api.put<User>(`/users/${id}`, b, { silent: true }); }
  setStatus(id: number, status: User['status']) { return this.api.patch<User>(`/users/${id}/status`, { status }, { silent: true }); }
  setRoles(id: number, roles: RoleKey[]) { return this.api.put<User>(`/users/${id}/roles`, { roles }, { silent: true }); }
  remove(id: number) { return this.api.delete(`/users/${id}`, { silent: true }); }
}

@Injectable({ providedIn: 'root' })
export class PassengerService {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.getPaged<SavedPassenger>('/passengers', { params: q }); }
  get(id: number) { return this.api.get<SavedPassenger>(`/passengers/${id}`); }
  history(id: number) { return this.api.get<{ id: number; booking: Booking; seat?: Booking['passengers'][number]['seat'] }[]>(`/passengers/${id}/history`); }
  create(b: unknown) { return this.api.post<SavedPassenger>('/passengers', b, { silent: true }); }
  update(id: number, b: unknown) { return this.api.put<SavedPassenger>(`/passengers/${id}`, b, { silent: true }); }
  remove(id: number) { return this.api.delete(`/passengers/${id}`, { silent: true }); }
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiClient);
  create(b: BookingPayload) { return this.api.post<Booking>('/bookings', b, { silent: true }); }
  list(q: PageQuery = {}) { return this.api.getPaged<Booking>('/bookings', { params: q }); }
  get(id: number) { return this.api.get<Booking>(`/bookings/${id}`); }
  byPnr(pnr: string) { return this.api.get<Booking>(`/bookings/pnr/${encodeURIComponent(pnr)}`, { silent: true }); }
  quote(id: number, passengerIds?: number[]) { return this.api.get<CancellationQuote>(`/bookings/${id}/cancellation-quote`, { params: { passengerIds: passengerIds?.join(',') } }); }
  cancel(id: number, b: { passengerIds?: number[]; reason?: string }) { return this.api.post<Booking>(`/bookings/${id}/cancel`, b, { silent: true }); }
  cancellations(q: PageQuery = {}) { return this.api.getPaged<CancellationRow>('/cancellations', { params: q }); }
  rules() { return this.api.get<CancellationRule[]>('/cancellations/rules'); }
  setRules(rules: { minHoursBefore: number; chargePercent: number; label: string }[]) { return this.api.put<CancellationRule[]>('/cancellations/rules', { rules }, { silent: true }); }
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiClient);
  initiate(b: { bookingId: number; method: PaymentMethod; cardLast4?: string }) { return this.api.post<Payment>('/payments', b, { silent: true }); }
  /** Verification step of the backend's payment flow (the configured provider is the built-in simulation gateway). */
  confirm(id: number, outcome: 'SUCCESS' | 'FAILURE') { return this.api.post<Payment>(`/payments/${id}/confirm`, { outcome }, { silent: true }); }
  get(id: number) { return this.api.get<Payment>(`/payments/${id}`); }
  receipt(id: number) { return this.api.get<Receipt>(`/payments/${id}/receipt`); }
  list(q: PageQuery = {}) { return this.api.getPaged<Payment>('/payments', { params: q }); }
}

@Injectable({ providedIn: 'root' })
export class RefundService {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.getPaged<Refund>('/refunds', { params: q }); }
  get(id: number) { return this.api.get<Refund>(`/refunds/${id}`); }
}

@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private readonly api = inject(ApiClient);
  list(q: { page?: number; size?: number; unread?: boolean } = {}, quiet = false) {
    return this.api.getEnvelope<NotificationPage>('/notifications', { params: { ...q, unread: q.unread ? 'true' : undefined }, noLoading: quiet, silent: quiet });
  }
  markRead(id: number) { return this.api.patch<null>(`/notifications/${id}/read`, {}, { noLoading: true }); }
  markAllRead() { return this.api.patch<null>('/notifications/read-all'); }
  prefs() { return this.api.get<NotificationPrefs>('/notifications/preferences'); }
  setPrefs(p: NotificationPrefs) { return this.api.put<NotificationPrefs>('/notifications/preferences', p); }
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);
  stats() { return this.api.get<Stats>('/admin/stats'); }
}

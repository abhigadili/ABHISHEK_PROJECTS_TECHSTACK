import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { Coupon, Delivery, Order, OrderSummary, Page, Partner, Payment, Refund, Restaurant, Review, UserDto } from '../models';

/** Delivery-partner API. */
@Injectable({ providedIn: 'root' })
export class DeliveryApi {
  private a = inject(Api);
  me() { return this.a.get<Partner>('/api/delivery/me'); }
  update(b: unknown) { return this.a.put<Partner>('/api/delivery/me', b); }
  online(online: boolean) { return this.a.patch<Partner>('/api/delivery/me/status', { online }); }
  location(latitude: number, longitude: number) { return this.a.patch<Partner>('/api/delivery/me/location', { latitude, longitude }); }
  current() { return this.a.get<Delivery[]>('/api/delivery/me/current'); }
  history(page = 0) { return this.a.get<Page<Delivery>>('/api/delivery/me/history', { page, size: 20 }); }
  performance() { return this.a.get<any>('/api/delivery/me/performance'); }
  act(id: number, action: 'accept' | 'reject' | 'pickup' | 'complete', reason?: string) { return this.a.post<Delivery>(`/api/delivery/${id}/${action}`, reason ? { reason } : {}); }
}

/** Administrator API (user management, approvals, monitoring of orders/payments/refunds/delivery, coupons, moderation). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private a = inject(Api);
  dashboard() { return this.a.get<any>('/api/admin/dashboard'); }
  activity(page = 0) { return this.a.get<Page<any>>('/api/admin/activity', { page, size: 15 }); }
  config() { return this.a.get<any[]>('/api/admin/config'); }
  setConfig(key: string, value: string) { return this.a.put<any>(`/api/admin/config/${key}`, { value }); }
  users(q: Record<string, unknown>) { return this.a.get<Page<UserDto>>('/api/users', q); }
  setUserStatus(id: number, status: string) { return this.a.patch<UserDto>(`/api/users/${id}/status`, { status }); }
  createAdmin(b: unknown) { return this.a.post<UserDto>('/api/users/admins', b); }
  restaurants(q: Record<string, unknown>) { return this.a.get<Page<Restaurant>>('/api/restaurants/admin/list', q); }
  restaurantAction(id: number, action: 'approve' | 'reject' | 'suspend' | 'deactivate' | 'reactivate', reason?: string) { return this.a.post<Restaurant>(`/api/restaurants/${id}/${action}`, reason ? { reason } : {}); }
  orders(q: Record<string, unknown>) { return this.a.get<Page<OrderSummary>>('/api/orders', q); }
  order(id: number) { return this.a.get<Order>(`/api/orders/${id}`); }
  cancelOrder(id: number, reason: string) { return this.a.post<Order>(`/api/orders/${id}/cancel`, { reason }); }
  payments(q: Record<string, unknown>) { return this.a.get<Page<Payment>>('/api/payments', q); }
  refunds(q: Record<string, unknown>) { return this.a.get<Page<Refund>>('/api/refunds', q); }
  retryRefund(id: number) { return this.a.post<Refund>(`/api/refunds/${id}/retry`); }
  deliveries(q: Record<string, unknown>) { return this.a.get<Page<Delivery>>('/api/delivery', q); }
  trail(id: number) { return this.a.get<any[]>(`/api/delivery/${id}/trail`); }
  partners() { return this.a.get<Partner[]>('/api/delivery/partners'); }
  suspendPartner(id: number, value: boolean) { return this.a.patch<Partner>(`/api/delivery/partners/${id}/suspended?value=${value}`); }
  coupons(page = 0) { return this.a.get<Page<Coupon>>('/api/coupons', { page, size: 20 }); }
  createCoupon(b: unknown) { return this.a.post<Coupon>('/api/coupons', b); }
  couponActive(id: number, active: boolean) { return this.a.patch<Coupon>(`/api/coupons/${id}/active`, { active }); }
  redemptions(id: number) { return this.a.get<Page<any>>(`/api/coupons/${id}/redemptions`); }
  campaigns() { return this.a.get<any[]>('/api/coupons/campaigns'); }
  createCampaign(b: unknown) { return this.a.post<any>('/api/coupons/campaigns', b); }
  reviews(q: Record<string, unknown>) { return this.a.get<Page<Review>>('/api/reviews/admin', q); }
  hideReview(id: number, note: string) { return this.a.post<Review>(`/api/reviews/${id}/hide`, { note }); }
  restoreReview(id: number) { return this.a.post<Review>(`/api/reviews/${id}/restore`); }
  inventoryOverview() { return this.a.get<any>('/api/inventory/overview'); }
  notificationHistory(page = 0) { return this.a.get<Page<any>>('/api/notifications/admin/history', { page, size: 25 }); }
}

/** Kafka monitoring, event audit, logging and health (admin only; Angular never talks to Kafka or Elasticsearch). */
@Injectable({ providedIn: 'root' })
export class MonitoringApi {
  private a = inject(Api);
  cluster() { return this.a.get<any>('/api/kafka/cluster'); }
  topics() { return this.a.get<any[]>('/api/kafka/topics'); }
  topic(name: string) { return this.a.get<any>(`/api/kafka/topics/${name}`); }
  messages(topic: string, q: Record<string, unknown>) { return this.a.get<any[]>(`/api/kafka/topics/${topic}/messages`, q); }
  groups() { return this.a.get<any[]>('/api/kafka/groups'); }
  flow() { return this.a.get<any>('/api/kafka/flow'); }
  deadLetters() { return this.a.get<any[]>('/api/kafka/dead-letters'); }
  publishTest(b: unknown) { return this.a.post<any>('/api/kafka/publish-test', b); }
  audit(q: Record<string, unknown>) { return this.a.get<Page<any>>('/api/audit/events', q); }
  failed(q: Record<string, unknown>) { return this.a.get<Page<any>>('/api/audit/failed', q); }
  auditEvent(id: number) { return this.a.get<any>(`/api/audit/events/${id}`); }
  trace(cid: string) { return this.a.get<any[]>(`/api/audit/trace/${encodeURIComponent(cid)}`); }
  auditStats() { return this.a.get<any>('/api/audit/stats'); }
  replay(id: number) { return this.a.post<any>(`/api/audit/events/${id}/replay`); }
  health() { return this.a.get<any[]>('/api/monitoring/services', {}, true); }
  logConfig() { return this.a.get<any>('/api/logs/config'); }
  logs(q: Record<string, unknown>) { return this.a.get<any>('/api/logs/search', q); }
  logCorrelation(cid: string) { return this.a.get<any>(`/api/logs/correlation/${encodeURIComponent(cid)}`); }
  logOverview(minutes: number) { return this.a.get<any>('/api/logs/overview', { minutes }); }
  logEntry(index: string, id: string) { return this.a.get<any>(`/api/logs/entry/${index}/${id}`); }
}

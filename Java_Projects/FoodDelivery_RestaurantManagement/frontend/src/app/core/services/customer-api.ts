import { Injectable, inject } from '@angular/core';
import { Api } from './api';
import { Address, Cart, Menu, MenuItem, Notification, Order, OrderSummary, Page, Payment, Refund, Restaurant, Review, SavedMethod, Summary } from '../models';

@Injectable({ providedIn: 'root' })
export class CustomerApi {
  private a = inject(Api);
  // discovery
  restaurants(q: Record<string, unknown>) { return this.a.get<Page<Restaurant>>('/api/restaurants', q); }
  nearby(lat: number, lng: number, radiusKm = 8) { return this.a.get<Restaurant[]>('/api/restaurants/nearby', { lat, lng, radiusKm }); }
  cuisines() { return this.a.get<string[]>('/api/restaurants/cuisines'); }
  categories() { return this.a.get<string[]>('/api/restaurants/categories'); }
  restaurant(id: number) { return this.a.get<Restaurant>(`/api/restaurants/${id}`); }
  menu(id: number) { return this.a.get<Menu>(`/api/menu/restaurants/${id}`); }
  popular(restaurantId?: number) { return this.a.get<MenuItem[]>('/api/menu/popular', { restaurantId, limit: 8 }); }
  search(q: Record<string, unknown>) { return this.a.get<any>('/api/search', q); }
  suggest(q: string) { return this.a.get<string[]>('/api/search/suggest', { q }, true); }
  offers(restaurantId?: number) { return this.a.get<any[]>('/api/coupons/public/active', { restaurantId }); }
  campaigns() { return this.a.get<any[]>('/api/coupons/public/campaigns'); }
  reviews(rid: number, page = 0) { return this.a.get<Page<Review>>(`/api/reviews/restaurant/${rid}`, { page, size: 6 }); }
  reviewSummary(rid: number) { return this.a.get<Summary>(`/api/reviews/summary/restaurant/${rid}`); }
  // cart
  cart() { return this.a.get<Cart>('/api/cart'); }
  addToCart(body: unknown, replace = false) { return this.a.post<Cart>('/api/cart/items', body, {}, { replace }); }
  updateCartItem(id: number, body: unknown) { return this.a.patch<Cart>(`/api/cart/items/${id}`, body); }
  removeCartItem(id: number) { return this.a.delete<Cart>(`/api/cart/items/${id}`); }
  clearCart() { return this.a.delete<void>('/api/cart'); }
  applyCoupon(code: string) { return this.a.put<Cart>('/api/cart/coupon', { code }); }
  removeCoupon() { return this.a.delete<Cart>('/api/cart/coupon'); }
  // profile & addresses
  me() { return this.a.get<any>('/api/customers/me'); }
  updateMe(body: unknown) { return this.a.put<any>('/api/customers/me', body); }
  avatar(f: File) { return this.a.upload<any>('/api/customers/me/avatar', f); }
  addresses() { return this.a.get<Address[]>('/api/customers/me/addresses'); }
  addAddress(b: unknown) { return this.a.post<Address>('/api/customers/me/addresses', b); }
  updateAddress(id: number, b: unknown) { return this.a.put<Address>(`/api/customers/me/addresses/${id}`, b); }
  defaultAddress(id: number) { return this.a.patch<Address>(`/api/customers/me/addresses/${id}/default`); }
  deleteAddress(id: number) { return this.a.delete<void>(`/api/customers/me/addresses/${id}`); }
  activity() { return this.a.get<Page<any>>('/api/customers/me/activity'); }
  // orders & payments
  placeOrder(body: unknown, key: string) { return this.a.post<Order>('/api/orders', body, { 'Idempotency-Key': key }); }
  myOrders(q: Record<string, unknown>) { return this.a.get<Page<OrderSummary>>('/api/orders/my', q); }
  order(id: number) { return this.a.get<Order>(`/api/orders/${id}`); }
  cancelOrder(id: number, reason: string) { return this.a.post<Order>(`/api/orders/${id}/cancel`, { reason }); }
  payment(orderId: number) { return this.a.get<Payment>(`/api/payments/order/${orderId}`, {}, true); }
  pay(orderId: number, body: unknown, key: string) { return this.a.post<Payment>(`/api/payments/order/${orderId}/pay`, body, { 'Idempotency-Key': key }); }
  refund(orderId: number) { return this.a.get<Refund>(`/api/refunds/order/${orderId}`, {}, true); }
  myPayments() { return this.a.get<Payment[]>('/api/payments/my'); }
  methods() { return this.a.get<SavedMethod[]>('/api/payments/methods'); }
  saveMethod(b: unknown) { return this.a.post<SavedMethod>('/api/payments/methods', b); }
  deleteMethod(id: number) { return this.a.delete<void>(`/api/payments/methods/${id}`); }
  delivery(orderId: number) { return this.a.get<any>(`/api/delivery/order/${orderId}`, {}, true); }
  // reviews
  reviewable() { return this.a.get<any[]>('/api/reviews/reviewable'); }
  createReview(b: unknown) { return this.a.post<Review>('/api/reviews', b); }
  myReviews() { return this.a.get<Page<Review>>('/api/reviews/my'); }
  // notifications
  notifications(unreadOnly = false, page = 0) { return this.a.get<Page<Notification>>('/api/notifications', { unreadOnly, page, size: 20 }); }
  unread() { return this.a.get<{ unread: number }>('/api/notifications/unread-count', {}, true); }
  markRead(id: number) { return this.a.patch<Notification>(`/api/notifications/${id}/read`); }
  readAll() { return this.a.post<any>('/api/notifications/read-all'); }
}

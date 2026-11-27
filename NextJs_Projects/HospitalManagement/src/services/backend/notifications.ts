import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import type { AppNotification, Page, SendNotificationRequest } from '@/types';

export const notificationService = {
  my: (p: { page?: number; size?: number } = {}) => backendFetch<Page<AppNotification>>('/api/notifications/my', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  all: (p: { eventType?: string; email?: string; page?: number; size?: number } = {}) => backendFetch<Page<AppNotification>>('/api/notifications', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  get: (id: number) => backendFetch<AppNotification>(`/api/notifications/${id}`, { cache: 'no-store' }),
  send: (b: SendNotificationRequest) => backendFetch<AppNotification>('/api/notifications/send', { method: 'POST', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
};

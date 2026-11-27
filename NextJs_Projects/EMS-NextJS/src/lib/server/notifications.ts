import 'server-only';
import { z } from 'zod';
import { apiFetch, apiPaged } from './api-client';
import { notificationSchema, type AppNotification } from '@/schemas/api';

// Notifications are private and change constantly → never cached.
export const listNotifications = (q: { page?: number; limit?: number; unread?: boolean }) => apiPaged<AppNotification>('/notifications', { query: { ...q }, schema: z.array(notificationSchema) });
export const unreadCount = () => apiFetch('/notifications/unread-count', { schema: z.object({ unread: z.number() }) }).then((r) => r.data.unread);
export const markRead = (ids?: number[]) => apiFetch('/notifications/read', { method: 'POST', body: ids?.length ? { ids } : {} });

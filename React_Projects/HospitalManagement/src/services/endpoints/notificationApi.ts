import { http } from '@/services/api/http';
import type { AppNotification, Page, SendNotificationRequest } from '@/types';

export interface NotificationListParams {
  eventType?: string;
  email?: string;
  page?: number;
  size?: number;
}

export const notificationApi = {
  /** ADMIN only: every notification in the system. */
  all: (params: NotificationListParams, signal?: AbortSignal) => http.get<Page<AppNotification>>('/notifications', { ...params }, signal),
  /** Any user: messages addressed to the caller's e-mail. */
  my: (params: { page?: number; size?: number }, signal?: AbortSignal) => http.get<Page<AppNotification>>('/notifications/my', { ...params }, signal),
  get: (id: number, signal?: AbortSignal) => http.get<AppNotification>(`/notifications/${id}`, undefined, signal),
  send: (body: SendNotificationRequest) => http.post<AppNotification>('/notifications/send', body),
};

import { http } from '@/api/httpClient';

export const notificationApi = {
  unreadCount: async (signal?: AbortSignal) =>
    (
      await http.get<{ data: { unread: number } }>('/notifications/unread-count', {
        signal,
        skipGlobalError: true,
      })
    ).data.data.unread,
};

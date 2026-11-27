import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/endpoints/notificationApi';
import { queryKeys } from '@/services/queryKeys';
import type { SendNotificationRequest } from '@/types';

export function useNotificationPage(scope: 'all' | 'my', page: number, eventType?: string, size = 15) {
  return useQuery({
    queryKey: queryKeys.notifications.list(scope, { page, size, eventType }),
    queryFn: ({ signal }) => (scope === 'all' ? notificationApi.all({ page, size, eventType }, signal) : notificationApi.my({ page, size }, signal)),
    placeholderData: keepPreviousData,
    meta: { errorMessage: 'Could not load notifications' },
  });
}

export function useNotificationById(id: number, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.notifications.detail(id), queryFn: ({ signal }) => notificationApi.get(id, signal), enabled: enabled && id > 0 });
}

export function useSendNotification() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: SendNotificationRequest) => notificationApi.send(b), meta: { silent: true }, onSuccess: () => void qc.invalidateQueries({ queryKey: queryKeys.notifications.all }) });
}

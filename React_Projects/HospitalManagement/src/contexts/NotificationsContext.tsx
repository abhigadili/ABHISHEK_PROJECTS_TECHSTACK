import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '@/services/endpoints/notificationApi';
import { queryKeys } from '@/services/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { readJson, writeJson } from '@/utils/storage';
import type { AppNotification } from '@/types';

/**
 * Notification centre (Context API + custom hook).
 * The backend has NO read/unread flag and no push channel. What is real:  GET /notifications (ADMIN) and
 * GET /notifications/my (everyone else) which we poll every 30 s. What is local: "read" ids, remembered per user in
 * this browser's localStorage (clearly labelled in the UI).
 */
interface NotificationsValue {
  items: AppNotification[];
  total: number;
  unreadCount: number;
  isLoading: boolean;
  isError: boolean;
  scope: 'all' | 'my';
  isRead: (id: number) => boolean;
  markRead: (id: number) => void;
  markAllRead: () => void;
  refresh: () => void;
}
const NotificationsContext = createContext<NotificationsValue | null>(null);
const FEED_SIZE = 50;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const online = useOnlineStatus();
  const scope: 'all' | 'my' = role === 'ADMIN' ? 'all' : 'my';
  const storageKey = user ? `hms.notifications.read.${user.id}` : null;
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setReadIds(storageKey ? new Set(readJson<number[]>(storageKey, [])) : new Set());
  }, [storageKey]);

  const query = useQuery({
    queryKey: queryKeys.notifications.feed(scope),
    queryFn: ({ signal }) => (scope === 'all' ? notificationApi.all({ page: 0, size: FEED_SIZE }, signal) : notificationApi.my({ page: 0, size: FEED_SIZE }, signal)),
    enabled: !!user,
    refetchInterval: online ? 30_000 : false, // polling (REST) - the backend has no websocket/SSE
    refetchIntervalInBackground: false,
    meta: { silent: true },
  });

  const persist = useCallback(
    (next: Set<number>) => {
      if (storageKey) writeJson(storageKey, [...next].slice(-2000));
    },
    [storageKey],
  );

  const markRead = useCallback(
    (id: number) =>
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev).add(id);
        persist(next);
        return next;
      }),
    [persist],
  );

  const items = useMemo(() => query.data?.content ?? [], [query.data]);
  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((n) => next.add(n.id));
      persist(next);
      return next;
    });
  }, [items, persist]);

  const refetch = query.refetch;
  const value = useMemo<NotificationsValue>(
    () => ({
      items,
      total: query.data?.totalElements ?? 0,
      unreadCount: items.filter((n) => !readIds.has(n.id)).length,
      isLoading: query.isLoading,
      isError: query.isError,
      scope,
      isRead: (id) => readIds.has(id),
      markRead,
      markAllRead,
      refresh: () => void refetch(),
    }),
    [items, query.data?.totalElements, query.isLoading, query.isError, readIds, scope, markRead, markAllRead, refetch],
  );
  return <NotificationsContext value={value}>{children}</NotificationsContext>;
}

export function useNotificationCenter(): NotificationsValue {
  const v = use(NotificationsContext);
  if (!v) throw new Error('useNotificationCenter must be used inside <NotificationsProvider>');
  return v;
}

/** Maps backend eventType strings to a UI category used for filtering/icons. */
export function notificationCategory(eventType: string): 'Appointment' | 'Lab' | 'Billing' | 'Prescription' | 'Other' {
  const t = eventType.toUpperCase();
  if (t.includes('APPOINTMENT')) return 'Appointment';
  if (t.includes('LAB')) return 'Lab';
  if (t.includes('BILL') || t.includes('PAYMENT')) return 'Billing';
  if (t.includes('PRESCRIPTION') || t.includes('MEDICINE')) return 'Prescription';
  return 'Other';
}

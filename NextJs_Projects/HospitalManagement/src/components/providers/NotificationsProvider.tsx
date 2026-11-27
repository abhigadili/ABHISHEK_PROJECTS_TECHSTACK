'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api/clientApis';
import { markNotificationsReadAction } from '@/actions/notifications';
import { keys } from '@/services/queryKeys';
import { useAuth } from './AuthProvider';
import type { AppNotification } from '@/types';

/**
 * Context API + useReducer - Notifications. The backend stores no read-flag, so "read" ids live in a small cookie written by the
 * markNotificationsReadAction Server Action (visible to SSR pages and to this client context). Optimistic reducer update first,
 * Server Action second. Polling every 30 s through TanStack Query (the backend offers no push channel).
 */
type State = number[];
type Action = { type: 'hydrate'; ids: number[] } | { type: 'read'; ids: number[] };
const reducer = (s: State, a: Action): State => (a.type === 'hydrate' ? a.ids : [...new Set([...s, ...a.ids])]);

const readCookie = (name: string): number[] => {
  try { const m = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`)); return m ? JSON.parse(decodeURIComponent(m.slice(name.length + 1))) : []; } catch { return []; }
};

interface Ctx { items: AppNotification[]; unread: number; isRead: (id: number) => boolean; markRead: (ids: number[]) => void; markAllRead: () => void; loading: boolean }
const NotificationsCtx = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const cookieName = `hms_nread_${user.id}`;
  const [read, dispatch] = useReducer(reducer, []);
  const q = useQuery({ queryKey: keys.notifications.my, queryFn: ({ signal }) => notificationsApi.my(0, 50, signal), refetchInterval: 30_000, meta: { silent: true } });
  useEffect(() => { dispatch({ type: 'hydrate', ids: readCookie(cookieName) }); }, [cookieName]);
  const items = useMemo(() => q.data?.content ?? [], [q.data]);
  const markRead = useCallback((ids: number[]) => { const fresh = ids.filter((i) => !read.includes(i)); if (!fresh.length) return; dispatch({ type: 'read', ids: fresh }); void markNotificationsReadAction(fresh); }, [read]);
  const value = useMemo<Ctx>(() => ({ items, loading: q.isLoading, isRead: (id) => read.includes(id), unread: items.filter((n) => !read.includes(n.id)).length, markRead, markAllRead: () => markRead(items.map((n) => n.id)) }), [items, q.isLoading, read, markRead]);
  return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}
export function useNotifications() {
  const c = useContext(NotificationsCtx);
  if (!c) throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return c;
}

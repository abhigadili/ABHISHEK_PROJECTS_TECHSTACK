'use client';
import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { fetchNotifications, markAllRead, markedReadLocally, selectNotifications, selectUnread } from '@/store/notificationsSlice';

/** Polls the BFF while the tab is visible (the backend has no WebSocket/SSE). Cleans up its timer and listener. */
export function useNotifications(pollMs = 30_000) {
  const dispatch = useAppDispatch();
  const unread = useAppSelector(selectUnread);
  const items = useAppSelector(selectNotifications);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void dispatch(fetchNotifications()); };
    tick();
    const id = setInterval(tick, pollMs);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [dispatch, pollMs]);
  const markAll = useCallback(async () => {
    dispatch(markedReadLocally()); // optimistic
    const r = await dispatch(markAllRead());
    if (markAllRead.rejected.match(r)) void dispatch(fetchNotifications()); // roll back to the server's truth
  }, [dispatch]);
  return { unread, items, markAll };
}

import { useEffect, useEffectEvent } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { refreshUnreadCount } from '@/store/slices/notificationSlice';
import { useAppConfig } from '@/contexts/AppConfigContext';

/**
 * Keeps the unread badge fresh. The backend has no WebSocket/SSE, so this polls — but only while the tab is visible,
 * and always cleans its timer and listener up.
 */
export function useNotifications() {
  const dispatch = useAppDispatch();
  const { notificationPollMs } = useAppConfig();
  const unread = useAppSelector((s) => s.notifications.unread);

  // useEffectEvent: always sees the latest `dispatch` without making the interval effect re-subscribe
  const tick = useEffectEvent(() => {
    if (document.visibilityState === 'visible') void dispatch(refreshUnreadCount());
  });

  useEffect(() => {
    tick();
    const id = setInterval(tick, notificationPollMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [notificationPollMs]);

  return { unread, refresh: () => dispatch(refreshUnreadCount()) };
}

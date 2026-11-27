'use client';
import { useDebugValue, useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };
/** useSyncExternalStore over the browser's connectivity state + useDebugValue label for React DevTools. */
export function useOnlineStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  useDebugValue(online ? 'online' : 'offline');
  return online;
}

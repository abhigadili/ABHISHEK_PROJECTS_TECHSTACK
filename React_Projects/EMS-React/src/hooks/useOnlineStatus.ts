import { useDebugValue, useSyncExternalStore } from 'react';

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** A browser API (navigator.onLine) wrapped as an external store: no useState/useEffect pair, no tearing under concurrent rendering. */
export function useOnlineStatus(): boolean {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  useDebugValue(online ? 'online' : 'offline'); // label shown beside this custom hook in React DevTools
  return online;
}

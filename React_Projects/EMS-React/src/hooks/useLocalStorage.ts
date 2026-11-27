import { useCallback, useDebugValue, useSyncExternalStore } from 'react';

const EVENT = 'ems:local-storage';

/**
 * localStorage as an *external store*: `useSyncExternalStore` subscribes to it, so every component using the same key re-renders
 * together (same tab via our custom event, other tabs via the native `storage` event) and there is no tearing in concurrent rendering.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (e: Event) => {
        if (!(e instanceof StorageEvent) || e.key === key || e.key === null) onChange();
      };
      window.addEventListener('storage', handler);
      window.addEventListener(EVENT, handler);
      return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener(EVENT, handler);
      };
    },
    [key],
  );

  // The snapshot is the raw string: strings are compared by value, so React only re-renders when the stored text really changes.
  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);

  let value = initial;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initial;
    }
  }
  useDebugValue(value, (v) => `${key} = ${JSON.stringify(v)}`); // shows up next to the hook in React DevTools

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      try {
        const prevRaw = localStorage.getItem(key);
        const prev = prevRaw === null ? initial : (JSON.parse(prevRaw) as T);
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* storage unavailable (private mode/quota): state simply won't persist */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, initial],
  );

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);

  return [value, set, remove];
}

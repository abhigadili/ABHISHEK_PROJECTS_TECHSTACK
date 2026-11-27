import { useCallback, useEffect, useRef } from 'react';

/** Throttling: runs `fn` at most once per `interval` ms (leading + trailing). Used for scroll-driven infinite loading. */
export function useThrottledCallback<A extends unknown[]>(fn: (...args: A) => void, interval = 400) {
  const fnRef = useRef(fn);
  const last = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => () => clearTimeout(trailing.current), []);
  return useCallback(
    (...args: A) => {
      const now = Date.now();
      const remaining = interval - (now - last.current);
      clearTimeout(trailing.current);
      if (remaining <= 0) {
        last.current = now;
        fnRef.current(...args);
      } else {
        trailing.current = setTimeout(() => {
          last.current = Date.now();
          fnRef.current(...args);
        }, remaining);
      }
    },
    [interval],
  );
}

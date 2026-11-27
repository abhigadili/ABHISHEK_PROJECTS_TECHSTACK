import { useCallback, useEffect, useRef, useState } from 'react';

/** Debouncing (value): returns `value` only after it stopped changing for `delay` ms. Used by every search box. */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Debouncing (callback): trailing-edge debounced function with a stable identity. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 350) {
  const fnRef = useRef(fn);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  return useCallback(
    (...args: A) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay],
  );
}

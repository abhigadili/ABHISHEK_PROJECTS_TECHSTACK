import { useEffect, useState } from 'react';
/** Returns `value` only after it stopped changing for `delayMs` (the effect cleanup cancels the pending timer). */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delayMs); return () => clearTimeout(t); }, [value, delayMs]);
  return v;
}

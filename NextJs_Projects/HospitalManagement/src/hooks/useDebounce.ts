'use client';
import { useEffect, useRef, useState } from 'react';

/** Debouncing: the value only settles after `delay` ms without changes (search boxes). */
export function useDebounce<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return v;
}

/** Throttling: at most one update per `interval` ms (scroll / resize driven UI). */
export function useThrottle<T>(value: T, interval = 500): T {
  const [v, setV] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const now = Date.now();
    const wait = Math.max(0, interval - (now - last.current));
    const t = setTimeout(() => { last.current = Date.now(); setV(value); }, wait);
    return () => clearTimeout(t);
  }, [value, interval]);
  return v;
}

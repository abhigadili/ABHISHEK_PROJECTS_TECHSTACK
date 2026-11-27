'use client';
import { useEffect, useRef } from 'react';

/** Automatic logout: after `minutes` without user input call `onIdle` (the layout posts to the logout action). */
export function useIdleLogout(minutes: number, onIdle: () => void) {
  const cb = useRef(onIdle);
  useEffect(() => { cb.current = onIdle; });
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(t); t = setTimeout(() => cb.current(), minutes * 60_000); };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(t); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [minutes]);
}

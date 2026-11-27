import { useEffect, useRef } from 'react';

/** Calls `onIdle` after `minutes` without keyboard/mouse/touch activity (automatic logout). Activity is throttled via timestamps. */
export function useIdleTimer(minutes: number, onIdle: () => void, enabled: boolean) {
  const cb = useRef(onIdle);
  useEffect(() => {
    cb.current = onIdle;
  });
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last >= minutes * 60_000) cb.current();
    }, 15_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(timer);
    };
  }, [minutes, enabled]);
}

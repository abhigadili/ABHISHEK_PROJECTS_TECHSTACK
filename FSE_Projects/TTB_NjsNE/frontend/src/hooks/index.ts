'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { useAppDispatch } from '@/store';
import { toastAdded } from '@/store/uiSlice';

/** Debounce a fast-changing value (search boxes) */
export function useDebounce<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
/** useSyncExternalStore: browser online/offline status (SSR-safe: server snapshot is `true`) */
export function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; },
    () => navigator.onLine, () => true);
}
/** localStorage-backed state that is hydration-safe (initial render always uses `initial`, real value is read after mount). */
export function useLocalStorage<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  useEffect(() => { try { const r = localStorage.getItem(key); if (r) setVal(JSON.parse(r) as T); } catch { /* blocked storage */ } }, [key]);
  const set = useCallback((next: T) => { setVal(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } }, [key]);
  return [val, set] as const;
}
/** Close popovers when the user clicks outside / presses Escape */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  const cb = useRef(onOutside); useEffect(() => { cb.current = onOutside; });
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cb.current(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [ref, active]);
}
/** useLayoutEffect: reset scroll before paint on navigation so pages never flash at the old offset */
export function useScrollTopOnNavigate() {
  const pathname = usePathname();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
}
/** Countdown to a deadline (seat-hold timer). Returns remaining seconds, 0 when over. */
export function useCountdown(deadline?: string | null) {
  const target = deadline ? new Date(deadline).getTime() : 0;
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((target - Date.now()) / 1000)));
  useEffect(() => {
    if (!target) return;
    const tick = () => setLeft(Math.max(0, Math.floor((target - Date.now()) / 1000))); tick();
    const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [target]);
  return left;
}
export function useToast() {
  const dispatch = useAppDispatch();
  return useCallback((kind: 'success' | 'error' | 'info', title: string, message?: string) => dispatch(toastAdded({ kind, title, message })), [dispatch]);
}
export { useAuth } from '@/providers/AuthProvider';
export { useConfirm } from '@/providers/ConfirmProvider';

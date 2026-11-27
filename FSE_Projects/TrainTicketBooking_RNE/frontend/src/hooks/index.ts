import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { tokenStore } from '@/services/tokenStore';
import { hasRole, isStaffLike } from '@/store/authSlice';
import { useAppSelector } from '@/store';
import type { RoleKey } from '@/types';
import { ConfirmContext } from '@/providers/ConfirmProvider';

/** Debounce a fast-changing value (search boxes) */
export function useDebounce<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
/** useSyncExternalStore #1: browser online/offline state */
export function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; },
    () => navigator.onLine, () => true);
}
/** useSyncExternalStore #2: the in-memory access token (re-renders when it is rotated / cleared) */
export const useAccessToken = () => useSyncExternalStore(tokenStore.subscribe, tokenStore.get);
/** Persist a small preference (typed) in localStorage, tolerant of blocked storage */
export function useLocalStorage<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(() => { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : initial; } catch { return initial; } });
  const set = useCallback((next: T) => { setVal(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } }, [key]);
  return [val, set] as const;
}
/** Close popovers when the user clicks outside / presses Escape */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutside: () => void, active = true) {
  const cb = useRef(onOutside); cb.current = onOutside;
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') cb.current(); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [ref, active]);
}
export const useDocumentTitle = (title: string) => { useEffect(() => { document.title = `${title} · Train Ticket Booking`; }, [title]); };
/** useLayoutEffect: reset scroll before paint on every navigation so pages never flash at the old scroll offset */
export function useScrollTopOnNavigate() {
  const { pathname } = useLocation();
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
export const useAuth = () => {
  const { user, status, error } = useAppSelector((s) => s.auth);
  return { user, status, error, isAuthenticated: !!user, isStaff: isStaffLike(user), isAdmin: hasRole(user, 'ADMIN'), hasRole: (...r: RoleKey[]) => hasRole(user, ...r) };
};
export const useConfirm = () => { const c = useContext(ConfirmContext); if (!c) throw new Error('useConfirm must be used inside <ConfirmProvider>'); return c; };
export const useToast = () => {
  const dispatch = useAppDispatchLazy();
  return useCallback((kind: 'success' | 'error' | 'info', title: string, message?: string) => dispatch(kind, title, message), [dispatch]);
};
import { useAppDispatch } from '@/store';
import { toastAdded } from '@/store/uiSlice';
function useAppDispatchLazy() {
  const d = useAppDispatch();
  return useCallback((kind: 'success' | 'error' | 'info', title: string, message?: string) => d(toastAdded({ kind, title, message })), [d]);
}

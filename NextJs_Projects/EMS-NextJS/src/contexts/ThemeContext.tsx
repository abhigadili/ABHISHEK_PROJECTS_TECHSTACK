'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'ems.theme';
const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` reads localStorage on the client but uses `getServerSnapshot` ("light") during server rendering AND during
 * hydration, so the first client render matches the server HTML (no hydration mismatch); React then re-renders with the stored value.
 */
const subscribe = (cb: () => void) => { listeners.add(cb); window.addEventListener('storage', cb); return () => { listeners.delete(cb); window.removeEventListener('storage', cb); }; };
const getSnapshot = (): Theme => { try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
const getServerSnapshot = (): Theme => 'light';

interface ThemeCtx { theme: Theme; toggle: () => void }
const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  const toggle = useCallback(() => {
    try { localStorage.setItem(KEY, getSnapshot() === 'dark' ? 'light' : 'dark'); } catch { /* storage unavailable */ }
    listeners.forEach((l) => l());
  }, []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>');
  return c;
}

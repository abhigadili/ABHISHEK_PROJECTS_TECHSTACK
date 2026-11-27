'use client';
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Mode = 'light' | 'dark';
const KEY = 'hms-theme';

/** Tiny external store over localStorage + <html class="dark"> - read with useSyncExternalStore (hydration-safe). */
const listeners = new Set<() => void>();
const read = (): Mode => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

const ThemeCtx = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, read, () => 'light' as Mode);
  const apply = useCallback((m: Mode) => {
    document.documentElement.classList.toggle('dark', m === 'dark');
    try { localStorage.setItem(KEY, m); } catch { /* private mode */ }
    listeners.forEach((l) => l());
  }, []);
  useEffect(() => { listeners.forEach((l) => l()); }, []);
  return <ThemeCtx.Provider value={{ mode, toggle: () => apply(mode === 'dark' ? 'light' : 'dark') }}>{children}</ThemeCtx.Provider>;
}

/** Inline script (rendered in <head>) that applies the saved/system theme before first paint - no flash. */
export const themeInitScript = `try{var t=localStorage.getItem('${KEY}');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}`;

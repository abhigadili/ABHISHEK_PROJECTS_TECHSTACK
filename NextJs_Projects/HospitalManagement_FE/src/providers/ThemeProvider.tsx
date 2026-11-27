'use client';
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';
type Mode = 'light' | 'dark';
const KEY = 'hms-theme';
const listeners = new Set<() => void>();
const read = (): Mode => (typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light');
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useTheme = () => useContext(Ctx);
/** Context API (theme) over an external store read with useSyncExternalStore (hydration-safe). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, read, () => 'light' as Mode);
  const toggle = useCallback(() => { const next = mode === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('dark', next === 'dark'); try { localStorage.setItem(KEY, next); } catch { /* private mode */ } listeners.forEach((l) => l()); }, [mode]);
  return <Ctx.Provider value={{ mode, toggle }}>{children}</Ctx.Provider>;
}
/** Inline script run before first paint - applies the saved/system theme without a flash. */
export const themeInitScript = `try{var t=localStorage.getItem('${KEY}');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark')}catch(e){}`;

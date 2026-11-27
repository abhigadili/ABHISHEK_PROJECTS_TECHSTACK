import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { buildMuiTheme } from '@/styles/muiTheme';

export type ThemeMode = 'light' | 'dark' | 'system';
interface Ctx { mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (m: ThemeMode) => void }
const ThemeCtx = createContext<Ctx>({ mode: 'system', resolved: 'light', setMode: () => {} });
export const useThemeMode = () => useContext(ThemeCtx);
const KEY = 'hr.theme';
const sys = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** Theme context: light / dark / system, persisted. One source of truth for CSS variables, Bootstrap (data-bs-theme), Tailwind (data-theme) and MUI. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => { try { return (localStorage.getItem(KEY) as ThemeMode) || 'system'; } catch { return 'system'; } });
  const [systemPref, setSystemPref] = useState<'light' | 'dark'>(sys());
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSystemPref(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', h); return () => mq.removeEventListener('change', h);
  }, []);
  const resolved = mode === 'system' ? systemPref : mode;
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = resolved; el.dataset.bsTheme = resolved; el.style.colorScheme = resolved;
  }, [resolved]);
  const setMode = (m: ThemeMode) => { setModeState(m); try { localStorage.setItem(KEY, m); } catch { /* ignore */ } };
  const muiTheme = useMemo(() => createTheme(buildMuiTheme(resolved)), [resolved]);
  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);
  return (
    <ThemeCtx.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}><CssBaseline enableColorScheme />{children}</MuiThemeProvider>
    </ThemeCtx.Provider>
  );
}

'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material';
import { useLocalStorage } from '@/hooks';

type Mode = 'light' | 'dark';
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useThemeMode = () => useContext(Ctx);

/** Theme via Context: drives Tailwind's `dark` class AND the MUI ThemeProvider so DataGrid / MUI controls follow the same mode. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useLocalStorage<Mode>('ttb.theme', 'light'); const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const mode = mounted ? stored : 'light';
  const theme = useMemo(() => createTheme({ cssVariables: false, palette: { mode, primary: { main: '#4f46e5' } }, shape: { borderRadius: 10 }, typography: { fontFamily: 'var(--font-inter), system-ui, sans-serif', fontSize: 13 } }), [mode]);
  useEffect(() => { document.documentElement.classList.toggle('dark', mode === 'dark'); }, [mode]);
  const toggle = useCallback(() => setStored(stored === 'light' ? 'dark' : 'light'), [stored, setStored]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <Ctx.Provider value={value}><MuiThemeProvider theme={theme}><CssBaseline enableColorScheme />{children}</MuiThemeProvider></Ctx.Provider>;
}

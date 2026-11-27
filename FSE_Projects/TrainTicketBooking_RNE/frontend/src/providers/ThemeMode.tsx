import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocalStorage } from '@/hooks';

type Mode = 'light' | 'dark';
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} });
export const useThemeMode = () => useContext(Ctx);

/** MUI ThemeProvider (used by DataGrid & a few controls) kept in sync with Tailwind's `dark` class. */
export function ThemeMode({ children }: { children: ReactNode }) {
  const [mode, setMode] = useLocalStorage<Mode>('ttb.theme', 'light');
  const theme = useMemo(() => createTheme({ palette: { mode, primary: { main: '#4f46e5' } }, shape: { borderRadius: 10 }, typography: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13 } }), [mode]);
  useEffect(() => { document.documentElement.classList.toggle('dark', mode === 'dark'); document.body.style.background = mode === 'dark' ? '#0b1220' : '#f8fafc'; document.body.style.color = mode === 'dark' ? '#e2e8f0' : '#0f172a'; }, [mode]);
  const value = useMemo(() => ({ mode, toggle: () => setMode(mode === 'light' ? 'dark' : 'light') }), [mode, setMode]);
  return <Ctx.Provider value={value}><ThemeProvider theme={theme}><CssBaseline enableColorScheme />{children}</ThemeProvider></Ctx.Provider>;
}

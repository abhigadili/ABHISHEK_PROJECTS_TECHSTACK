import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { buildTheme } from '@/styles/theme';

export type ThemeMode = 'light' | 'dark';
interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}
const ThemeContext = createContext<ThemeContextValue | null>(null);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useLocalStorage<ThemeMode>('ems.theme', prefersDark() ? 'dark' : 'light');
  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [setMode]);
  const theme = useMemo(() => buildTheme(mode), [mode]); // rebuilding a theme is costly: only when `mode` changes
  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used inside <ThemeProvider>');
  return ctx;
}

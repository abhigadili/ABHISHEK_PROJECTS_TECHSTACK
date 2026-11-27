import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material';

type Mode = 'light' | 'dark';
interface ThemeValue {
  mode: Mode;
  toggle: () => void;
  setMode: (m: Mode) => void;
}
const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'hms.theme';

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Theme management: one source of truth drives the CSS variables (global.css), Tailwind `dark:` and the MUI theme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.classList.toggle('dark', mode === 'dark');
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);
  const toggle = useCallback(() => setModeState((m) => (m === 'light' ? 'dark' : 'light')), []);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: '#1d76f1' },
          secondary: { main: '#0e9f6e' },
          background: mode === 'dark' ? { default: '#0b1220', paper: '#111a2e' } : { default: '#f4f7fb', paper: '#ffffff' },
        },
        shape: { borderRadius: 10 },
        typography: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', button: { textTransform: 'none', fontWeight: 600 } },
        components: { MuiCard: { defaultProps: { variant: 'outlined' } } },
      }),
    [mode],
  );

  const value = useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);
  return (
    <ThemeContext value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeContext>
  );
}

export function useTheme(): ThemeValue {
  const v = use(ThemeContext);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}

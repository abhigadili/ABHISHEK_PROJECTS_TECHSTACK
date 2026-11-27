'use client';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useMemo, type ReactNode } from 'react';
import { useTheme } from './ThemeProvider';

/**
 * MUI integration for the App Router: AppRouterCacheProvider (Emotion SSR cache flushed through useServerInsertedHTML, so no style flash)
 * + a theme built from the SAME design tokens as Tailwind/Radix/shadcn, switching with the app's light/dark mode.
 * Used only by the modules that are built with MUI (patients, doctors, hospitals) so other routes do not pay for it.
 */
export function MuiProvider({ children }: { children: ReactNode }) {
  const { mode } = useTheme();
  const theme = useMemo(() => createTheme({
    cssVariables: false,
    palette: { mode, primary: { main: mode === 'dark' ? '#2dd4bf' : '#0f766e' }, secondary: { main: '#0ea5e9' }, background: { default: mode === 'dark' ? '#0b1220' : '#f4f7f9', paper: mode === 'dark' ? '#111a2b' : '#ffffff' }, divider: mode === 'dark' ? '#243247' : '#dbe3ea' },
    shape: { borderRadius: 10 },
    typography: { fontFamily: 'inherit', button: { textTransform: 'none', fontWeight: 600 } },
    components: { MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } }, MuiTextField: { defaultProps: { size: 'small', fullWidth: true } } },
  }), [mode]);
  return (
    <AppRouterCacheProvider options={{ key: 'mui', enableCssLayer: false }}>
      <MuiThemeProvider theme={theme}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>{children}</LocalizationProvider>
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  );
}

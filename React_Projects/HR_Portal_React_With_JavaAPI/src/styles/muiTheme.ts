import type { ThemeOptions } from '@mui/material';
/** Centralised theme tokens - the same palette feeds CSS variables (global.scss), so MUI/Tailwind/Bootstrap/shadcn stay visually identical. */
export const palette = {
  light: { primary: '#4f46e5', bg: '#f5f6fa', surface: '#ffffff', border: '#e4e7ee', text: '#1b2133', muted: '#667085' },
  dark: { primary: '#818cf8', bg: '#0f1320', surface: '#171c2e', border: '#2a3150', text: '#e6e9f5', muted: '#9aa4c0' },
};
export function buildMuiTheme(mode: 'light' | 'dark'): ThemeOptions {
  const p = palette[mode];
  return {
    palette: {
      mode,
      primary: { main: p.primary }, secondary: { main: '#0ea5a4' },
      success: { main: '#16a34a' }, warning: { main: '#d97706' }, error: { main: '#dc2626' }, info: { main: '#0284c7' },
      background: { default: p.bg, paper: p.surface }, text: { primary: p.text, secondary: p.muted }, divider: p.border,
    },
    shape: { borderRadius: 10 },
    typography: { fontFamily: "Inter, 'Noto Sans Telugu', 'Noto Sans Devanagari', system-ui, sans-serif", fontSize: 14, button: { textTransform: 'none', fontWeight: 600 } },
    components: {
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: { defaultProps: { disableElevation: true } },
    },
  };
}

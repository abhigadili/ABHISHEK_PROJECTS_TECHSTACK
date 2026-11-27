import { createTheme, responsiveFontSizes, type Theme } from '@mui/material/styles';

export function buildTheme(mode: 'light' | 'dark'): Theme {
  return responsiveFontSizes(
    createTheme({
      palette: {
        mode,
        primary: { main: mode === 'dark' ? '#64b5f6' : '#1565c0' },
        secondary: { main: '#00897b' },
        background:
          mode === 'dark'
            ? { default: '#0f1419', paper: '#171d24' }
            : { default: '#f4f6f9', paper: '#ffffff' },
      },
      shape: { borderRadius: 10 },
      typography: {
        fontFamily: '"Inter","Roboto","Helvetica","Arial",sans-serif',
        h4: { fontWeight: 700 },
        h5: { fontWeight: 700 },
        h6: { fontWeight: 600 },
      },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
        },
        MuiCard: { defaultProps: { variant: 'outlined' } },
        MuiPaper: { defaultProps: { variant: 'outlined' } },
        MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
        MuiFormControl: { defaultProps: { size: 'small' } },
      },
    }),
  );
}

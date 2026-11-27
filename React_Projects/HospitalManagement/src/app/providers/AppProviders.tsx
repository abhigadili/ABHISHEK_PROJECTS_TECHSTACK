import { lazy, Suspense, type ReactNode } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Toaster } from 'react-hot-toast';
import { store } from '../store';
import { queryClient } from '../queryClient';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';

// DevTools are a development-only dynamic import: they are not part of the production bundle.
const Devtools = import.meta.env.DEV ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools }))) : null;

/** Provider composition root: Redux -> TanStack Query -> Theme (MUI + CSS vars) -> Date adapter -> Auth. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <TooltipProvider delayDuration={250}>
              <AuthProvider>
                {children}
                <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: 'var(--hms-surface)', color: 'var(--hms-fg)', border: '1px solid var(--hms-border)', fontSize: 14 } }} />
              </AuthProvider>
            </TooltipProvider>
          </LocalizationProvider>
        </ThemeProvider>
        {Devtools && <Suspense fallback={null}><Devtools buttonPosition="bottom-left" /></Suspense>}
      </QueryClientProvider>
    </ReduxProvider>
  );
}

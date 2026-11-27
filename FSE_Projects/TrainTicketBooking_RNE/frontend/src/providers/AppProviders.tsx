import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from '@/components/ui/Toaster';
import { store } from '@/store';
import { toApiError } from '@/services/api';
import { ConfirmProvider } from './ConfirmProvider';
import { ThemeMode } from './ThemeMode';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: (n, e) => { const s = toApiError(e).status; return n < 2 && (s === 0 || s >= 500); } },
    mutations: { retry: 0 },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeMode>
          <BrowserRouter>
            <ConfirmProvider>{children}<Toaster /></ConfirmProvider>
          </BrowserRouter>
        </ThemeMode>
      </QueryClientProvider>
    </Provider>
  );
}

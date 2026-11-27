import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { store } from '@/store/redux';
import { ThemeProvider, useThemeMode } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from './AuthProvider';
import '@/i18n';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 }, mutations: { retry: 0 } },
});
function Toasts() { const { resolved } = useThemeMode(); return <ToastContainer position="top-right" autoClose={3500} theme={resolved} newestOnTop pauseOnFocusLoss={false} limit={4} />; }

/** Provider stack: Redux (auth/settings) · TanStack Query (server state) · Theme/Language/Config contexts · Auth bootstrap. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider>
          <ThemeProvider>
            <LanguageProvider>
              <TooltipProvider>
                <AuthProvider>{children}</AuthProvider>
                <Toasts />
              </TooltipProvider>
            </LanguageProvider>
          </ThemeProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </Provider>
  );
}

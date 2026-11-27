import { Provider as ReduxProvider } from 'react-redux';
import type { ReactNode } from 'react';
import type { AppStore } from '@/app/store/store';
import { AppConfigProvider } from '@/contexts/AppConfigContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuthenticationProvider } from '@/contexts/AuthenticationContext';
import { UserProvider } from '@/contexts/UserContext';
import { ConfirmProvider } from '@/components/dialogs/ConfirmDialog';
import { ToastHost } from '@/components/dialogs/ToastHost';

/**
 * Provider composition. ORDER MATTERS — each provider can use everything above it:
 *   Redux ▸ AppConfig ▸ Theme ▸ Notification(toasts) ▸ Authentication ▸ User ▸ Confirm
 * (Authentication reads Redux; User reads Authentication; the global HTTP error notifier needs Notification.)
 */
export function AppProviders({ store, children }: { store: AppStore; children: ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <AppConfigProvider>
        <ThemeProvider>
          <NotificationProvider>
            <AuthenticationProvider>
              <UserProvider>
                <ConfirmProvider>
                  {children}
                  <ToastHost />
                </ConfirmProvider>
              </UserProvider>
            </AuthenticationProvider>
          </NotificationProvider>
        </ThemeProvider>
      </AppConfigProvider>
    </ReduxProvider>
  );
}

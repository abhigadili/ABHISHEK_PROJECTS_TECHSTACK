'use client';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/Toaster';
import { AuthProvider } from './AuthProvider';
import { ConfirmProvider } from './ConfirmProvider';
import { QueryProvider } from './QueryProvider';
import { StoreProvider } from './StoreProvider';
import { ThemeProvider } from './ThemeProvider';

/** Provider stack for the whole app. Order matters: Query + Redux first (everything uses them), then theme, then auth, then UI helpers. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: false }}>
      <StoreProvider><QueryProvider><ThemeProvider><AuthProvider><ConfirmProvider>{children}<Toaster /></ConfirmProvider></AuthProvider></ThemeProvider></QueryProvider></StoreProvider>
    </AppRouterCacheProvider>
  );
}

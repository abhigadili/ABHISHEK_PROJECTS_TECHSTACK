import { Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import { Sidebar } from '@/components/layouts/Sidebar';
import { Header } from '@/components/layouts/Header';
import { Breadcrumbs } from '@/components/layouts/Breadcrumbs';
import { NetworkBanner } from '@/components/layouts/NetworkBanner';
import { TopProgress } from '@/components/layouts/TopProgress';
import { ErrorBoundary } from '@/components/error-boundaries/ErrorBoundary';
import { PageLoader } from '@/components/common/Spinner';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { HospitalProvider } from '@/contexts/HospitalContext';

/**
 * Authenticated layout route: sidebar + header + routed content.
 * <Suspense> shows a loader while a lazy route chunk downloads; the <ErrorBoundary> is keyed by pathname so a crashing
 * page is replaced by a fallback but the shell (and navigation) stays usable, and it resets on navigation.
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  return (
    <NotificationsProvider>
      <HospitalProvider>
        <div className="flex h-full min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopProgress />
            <NetworkBanner />
            <Header />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6" id="main">
              <Breadcrumbs />
              <ErrorBoundary resetKey={pathname} label="app-layout">
                <Suspense fallback={<PageLoader />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </HospitalProvider>
    </NotificationsProvider>
  );
}

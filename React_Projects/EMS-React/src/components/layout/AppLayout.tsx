import { Box, Container, Toolbar } from '@mui/material';
import { Suspense, useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { Footer } from './Footer';
import { Loading } from '@/components/common/Feedback';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/**
 * Protected layout route: header + sidebar + breadcrumbs + footer wrap whatever child route is active (<Outlet/>).
 * Suspense shows a spinner while a lazy route chunk downloads; the ErrorBoundary resets when the path changes.
 */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const toggle = useCallback(() => setMobileOpen((o) => !o), []);
  const close = useCallback(() => setMobileOpen(false), []);
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Header onMenu={toggle} />
      <Sidebar mobileOpen={mobileOpen} onClose={close} />
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Toolbar />
        <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3 }}>
          <Breadcrumbs />
          <ErrorBoundary resetKeys={[pathname]}>
            <Suspense fallback={<Loading page />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </Container>
        <Footer />
      </Box>
    </Box>
  );
}

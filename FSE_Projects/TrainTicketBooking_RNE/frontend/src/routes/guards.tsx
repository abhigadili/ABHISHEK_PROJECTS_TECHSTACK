import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '@/components/ui/Feedback';
import { useAuth } from '@/hooks';
import type { RoleKey } from '@/types';

/** Layout-route guard: any signed-in user. Unauthenticated visitors go to /login and come back afterwards. */
export function ProtectedRoute() {
  const { isAuthenticated, status } = useAuth(); const loc = useLocation();
  if (status !== 'ready') return <PageLoader />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
}
/** Layout-route guard: signed-in AND holding one of the given roles. */
export function RoleRoute({ roles }: { roles: RoleKey[] }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <Outlet /> : <Navigate to="/403" replace />;
}
/** Keep signed-in users out of login/register. */
export function GuestRoute() {
  const { isAuthenticated, status } = useAuth(); const loc = useLocation();
  if (status !== 'ready') return <PageLoader />;
  const from = (loc.state as { from?: string } | null)?.from;
  return isAuthenticated ? <Navigate to={from ?? '/account'} replace /> : <Outlet />;
}

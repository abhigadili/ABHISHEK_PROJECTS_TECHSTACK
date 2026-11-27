import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Loading } from '@/components/common/Feedback';
import type { Permission, Role } from '@/constants/roles';

/** Protected LAYOUT route: renders child routes only for a signed-in user, otherwise redirects to /login remembering where they wanted to go. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  if (isBootstrapping) return <Loading page label="Restoring your session…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />; // navigation state
  return <>{children ?? <Outlet />}</>;
}

/** Guest-only route (login, forgot password): signed-in users are bounced to where they were headed, or the dashboard. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  if (isBootstrapping) return <Loading page />;
  if (isAuthenticated) {
    const from = (location.state as { from?: { pathname: string; search?: string } } | null)?.from;
    return <Navigate to={from ? `${from.pathname}${from.search ?? ''}` : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

interface ProtectedProps {
  allowedRoles?: Role[];
  permission?: Permission;
  children?: ReactNode;
}

/**
 * Role-/permission-based route protection:
 *   <ProtectedRoute allowedRoles={["HR_ADMIN","SUPER_ADMIN"]}><EmployeeForm/></ProtectedRoute>
 * Used inline (children) or as a layout route (renders <Outlet/>). The backend independently validates every permission.
 */
export function ProtectedRoute({ allowedRoles, permission, children }: ProtectedProps) {
  const { hasRole, can, role } = usePermissions();
  const location = useLocation();
  const allowed = (!allowedRoles || hasRole(...allowedRoles)) && (!permission || can(permission));
  if (!role) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!allowed) return <Navigate to="/unauthorized" replace state={{ attempted: location.pathname }} />;
  return <>{children ?? <Outlet />}</>;
}

import type { ComponentType } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Permission } from '@/constants/permissions';
import type { Role } from '@/types';
import { PageLoader } from '@/components/common/Spinner';

/**
 * Higher-Order Components for authentication and authorization.
 *   withAuth(Page)                       - must be signed in
 *   withRoles(Page, ['ADMIN','DOCTOR'])  - signed in AND role in list
 *   withPermission(Page, 'lab:process')  - signed in AND role holds the permission
 * Unauthenticated users are redirected to /login (remembering where they wanted to go); authenticated users lacking
 * rights are sent to /access-denied.
 */
function useGate(check?: (role: Role) => boolean) {
  const { status, role } = useAuth();
  const location = useLocation();
  if (status === 'loading') return { element: <PageLoader label="Restoring your session…" /> } as const;
  if (status === 'anonymous' || !role) return { element: <Navigate to="/login" replace state={{ from: location.pathname + location.search }} /> } as const;
  if (check && !check(role)) return { element: <Navigate to="/access-denied" replace state={{ from: location.pathname }} /> } as const;
  return { element: null } as const;
}

export function withAuth<P extends object>(Wrapped: ComponentType<P>) {
  function WithAuth(props: P) {
    const gate = useGate();
    return gate.element ?? <Wrapped {...props} />;
  }
  WithAuth.displayName = `withAuth(${Wrapped.displayName ?? Wrapped.name})`;
  return WithAuth;
}

export function withRoles<P extends object>(Wrapped: ComponentType<P>, roles: readonly Role[]) {
  function WithRoles(props: P) {
    const gate = useGate((r) => roles.includes(r));
    return gate.element ?? <Wrapped {...props} />;
  }
  WithRoles.displayName = `withRoles(${Wrapped.displayName ?? Wrapped.name})`;
  return WithRoles;
}

export function withPermission<P extends object>(Wrapped: ComponentType<P>, permission: Permission) {
  function WithPermission(props: P) {
    const gate = useGate((r) => can(r, permission));
    return gate.element ?? <Wrapped {...props} />;
  }
  WithPermission.displayName = `withPermission(${Wrapped.displayName ?? Wrapped.name})`;
  return WithPermission;
}

/** Public-route HOC: signed-in users are bounced to the dashboard (login/register pages). */
export function withPublicOnly<P extends object>(Wrapped: ComponentType<P>) {
  function WithPublicOnly(props: P) {
    const { status } = useAuth();
    const location = useLocation();
    if (status === 'loading') return <PageLoader />;
    if (status === 'authenticated') {
      const from = (location.state as { from?: string } | null)?.from;
      return <Navigate to={from && !from.startsWith('/login') ? from : '/dashboard'} replace />;
    }
    return <Wrapped {...props} />;
  }
  WithPublicOnly.displayName = `withPublicOnly(${Wrapped.displayName ?? Wrapped.name})`;
  return WithPublicOnly;
}

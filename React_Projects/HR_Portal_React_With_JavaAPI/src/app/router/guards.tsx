import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { ErrorState } from '@/components/feedback/states';
import { useTranslation } from 'react-i18next';

/** Protected route: anonymous -> /login (remembering where to return), must-change-password -> /change-password. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, mustChangePassword } = useAppSelector((s) => s.auth); const loc = useLocation();
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}
/** Public-only route (login, forgot ...): authenticated users go to the dashboard. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { status, mustChangePassword } = useAppSelector((s) => s.auth);
  if (status === 'authenticated' && !mustChangePassword) return <Navigate to="/" replace />;
  return <>{children}</>;
}
/** Role / operation based page guard (UX only - the backend enforces every call). */
export function RequireAccess({ roles, anyOp, children }: { roles?: string[]; anyOp?: string[]; children: ReactNode }) {
  const p = usePermissions(); const { t } = useTranslation();
  const ok = (!roles && !anyOp) || (roles && p.hasRole(...roles)) || (anyOp && p.canAny(...anyOp));
  if (!ok) return <div className="hr-card mt-4"><ErrorState error={Object.assign(new Error(t('common.notAuthorized')), { status: 403 })} /></div>;
  return <>{children}</>;
}

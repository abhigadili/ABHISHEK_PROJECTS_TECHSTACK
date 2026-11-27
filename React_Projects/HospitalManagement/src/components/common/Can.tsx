import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { can, type Permission } from '@/constants/permissions';

/** Permission-based rendering: children are rendered only when the current role holds the permission. */
export function Can({ permission, children, fallback = null }: { permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  const { role } = useAuth();
  return <>{can(role, permission) ? children : fallback}</>;
}

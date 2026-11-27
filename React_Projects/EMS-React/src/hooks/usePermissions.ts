import { useCallback, useMemo } from 'react';
import { PERMISSIONS, type Permission, type Role } from '@/constants/roles';
import { useAuth } from './useAuth';

/** Permission-aware UI helpers. Hiding a button is a courtesy — the backend independently rejects forbidden calls. */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role ?? null;

  const can = useCallback(
    (permission: Permission) => (role ? (PERMISSIONS[permission] as readonly Role[]).includes(role) : false),
    [role],
  );
  const hasRole = useCallback((...roles: Role[]) => (role ? roles.includes(role) : false), [role]);

  return useMemo(
    () => ({ role, can, hasRole, isAdmin: can('employee:manage'), isManagerUp: can('leave:approve') }),
    [role, can, hasRole],
  );
}

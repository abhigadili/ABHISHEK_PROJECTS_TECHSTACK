import { useCallback, useMemo } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Role } from '@/constants/roles';

/** Permission-aware rendering helpers. Hiding a button is a courtesy; the server and the backend independently enforce access. */
export function usePermissions() {
  const { user, can } = useAuthContext();
  const hasRole = useCallback((...roles: Role[]) => roles.includes(user.role), [user.role]);
  return useMemo(() => ({ role: user.role, can, hasRole }), [user.role, can, hasRole]);
}

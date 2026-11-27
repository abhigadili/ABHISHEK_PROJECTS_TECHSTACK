import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission, Role } from '@/constants/roles';

/** Permission-based rendering: `<Can permission="employee:manage"><Button/></Can>`. Presentation only — never a security boundary. */
export function Can({
  permission,
  roles,
  children,
  fallback = null,
}: {
  permission?: Permission;
  roles?: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can, hasRole } = usePermissions();
  const allowed = (permission ? can(permission) : true) && (roles ? hasRole(...roles) : true);
  return <>{allowed ? children : fallback}</>;
}

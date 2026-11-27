export const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];
export const ADMIN_ROLES: readonly Role[] = ['SUPER_ADMIN', 'HR_ADMIN'];
export const MANAGER_UP: readonly Role[] = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];
export const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super Admin', HR_ADMIN: 'HR Admin', MANAGER: 'Manager', EMPLOYEE: 'Employee' };

/**
 * Permission map mirroring the backend's `authorize(...)` calls (docs/backend-api-integration.md). It is used on the SERVER for
 * route/action guards and on the client only to decide what to show. The Express API independently enforces every rule.
 */
export const PERMISSIONS = {
  'employee:manage': ADMIN_ROLES,
  'employee:view-compensation': ADMIN_ROLES,
  'department:manage': ADMIN_ROLES,
  'designation:manage': ADMIN_ROLES,
  'attendance:correct': ADMIN_ROLES,
  'attendance:reports': MANAGER_UP,
  'leave:approve': MANAGER_UP,
  'leave:administer': ADMIN_ROLES,
  'holiday:manage': ADMIN_ROLES,
  'dashboard:company': MANAGER_UP,
  'reports:view': MANAGER_UP,
  'reports:admin': ADMIN_ROLES,
  'users:manage': ADMIN_ROLES,
  'users:set-role': ['SUPER_ADMIN'],
} as const satisfies Record<string, readonly Role[]>;
export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | null | undefined, permission: Permission): boolean =>
  !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);

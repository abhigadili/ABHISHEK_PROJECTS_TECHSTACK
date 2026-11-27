export const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'HR_ADMIN'];
export const MANAGER_UP: Role[] = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'];

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  HR_ADMIN: 'HR Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
};

/**
 * UI-level permission map. It only decides what to SHOW; the Express backend independently authorises every request.
 * Mirrors the `authorize(...)` calls found in the backend route files (see docs/backend-api-integration.md).
 */
export const PERMISSIONS = {
  'employee:manage': ADMIN_ROLES,
  'employee:view-compensation': ADMIN_ROLES,
  'department:manage': ADMIN_ROLES,
  'designation:manage': ADMIN_ROLES,
  'attendance:correct': ADMIN_ROLES,
  'attendance:view-reports': MANAGER_UP,
  'attendance:view-department-report': ADMIN_ROLES,
  'leave:approve': MANAGER_UP,
  'leave:administer': ADMIN_ROLES,
  'holiday:manage': ADMIN_ROLES,
  'dashboard:view': MANAGER_UP,
  'reports:view': MANAGER_UP,
  'reports:admin': ADMIN_ROLES,
  'users:manage': ADMIN_ROLES,
  'users:set-role': ['SUPER_ADMIN'] as Role[],
  'audit:view': ADMIN_ROLES,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

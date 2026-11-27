// ============================================================
// WHAT: Application-wide constants
// WHY:  Magic strings/numbers scattered in code are a maintenance
//       nightmare. Central constants are easy to change and search.
// ============================================================

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  ADMIN: 'Admin',
  HR: 'HR',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  GUEST: 'Guest',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export const PERMISSIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  ASSIGN_ROOM: 'assign_room',
  MANAGE_EMPLOYEE: 'manage_employee',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role → Permission mapping (RBAC matrix)
// Interview Tip: RBAC (Role-Based Access Control) is the industry standard.
//               ABAC (Attribute-Based) is more granular but complex.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SuperAdmin: ['create','read','update','delete','approve','assign_room','manage_employee'],
  Admin:      ['create','read','update','delete','approve','assign_room','manage_employee'],
  HR:         ['create','read','update','manage_employee'],
  Manager:    ['read','update','assign_room','approve'],
  Employee:   ['read'],
  Guest:      ['read'],
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;

export const CACHE_KEYS = {
  COMPANIES: 'companies:all',
  COMPANY: (id: string) => `company:${id}`,
  DEPARTMENTS: 'departments:all',
  DEPARTMENT: (id: string) => `department:${id}`,
  EMPLOYEES: 'employees:all',
  EMPLOYEE: (id: string) => `employee:${id}`,
  ROOMS: 'rooms:all',
  ROOM: (id: string) => `room:${id}`,
  AVAILABLE_ROOMS: 'rooms:available',
};

export const COLLECTIONS = {
  USERS: 'users',
  COMPANIES: 'companies',
  EMPLOYEES: 'employees',
  DEPARTMENTS: 'departments',
  ROOMS: 'rooms',
  MEETINGS: 'meetings',
  ROLES: 'roles',
  PERMISSIONS: 'permissions',
  REFRESH_TOKENS: 'refreshTokens',
  AUDIT_LOGS: 'auditLogs',
};

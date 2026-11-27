"use strict";
// ============================================================
// WHAT: Application-wide constants
// WHY:  Magic strings/numbers scattered in code are a maintenance
//       nightmare. Central constants are easy to change and search.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLLECTIONS = exports.CACHE_KEYS = exports.HTTP_STATUS = exports.ROLE_PERMISSIONS = exports.PERMISSIONS = exports.ROLES = void 0;
exports.ROLES = {
    SUPER_ADMIN: 'SuperAdmin',
    ADMIN: 'Admin',
    HR: 'HR',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
    GUEST: 'Guest',
};
exports.PERMISSIONS = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    APPROVE: 'approve',
    ASSIGN_ROOM: 'assign_room',
    MANAGE_EMPLOYEE: 'manage_employee',
};
// Role → Permission mapping (RBAC matrix)
// Interview Tip: RBAC (Role-Based Access Control) is the industry standard.
//               ABAC (Attribute-Based) is more granular but complex.
exports.ROLE_PERMISSIONS = {
    SuperAdmin: ['create', 'read', 'update', 'delete', 'approve', 'assign_room', 'manage_employee'],
    Admin: ['create', 'read', 'update', 'delete', 'approve', 'assign_room', 'manage_employee'],
    HR: ['create', 'read', 'update', 'manage_employee'],
    Manager: ['read', 'update', 'assign_room', 'approve'],
    Employee: ['read'],
    Guest: ['read'],
};
exports.HTTP_STATUS = {
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
};
exports.CACHE_KEYS = {
    COMPANIES: 'companies:all',
    COMPANY: (id) => `company:${id}`,
    DEPARTMENTS: 'departments:all',
    DEPARTMENT: (id) => `department:${id}`,
    EMPLOYEES: 'employees:all',
    EMPLOYEE: (id) => `employee:${id}`,
    ROOMS: 'rooms:all',
    ROOM: (id) => `room:${id}`,
    AVAILABLE_ROOMS: 'rooms:available',
};
exports.COLLECTIONS = {
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

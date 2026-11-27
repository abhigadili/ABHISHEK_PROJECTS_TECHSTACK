import type { Role } from '@/types';

/**
 * Permission-based authorization layered on top of the six backend roles.
 * The table mirrors the capability matrix of the backend (docs/…-06-authentication-and-authorization.md); the backend
 * stays the real enforcement point - this only hides/blocks UI that would be answered with 403 anyway.
 */
export const PERMISSIONS = {
  'patients:read': ['ADMIN', 'DOCTOR', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF'],
  'patients:create': ['ADMIN', 'PATIENT'],
  'patients:update': ['ADMIN', 'PATIENT'],
  'patients:deactivate': ['ADMIN'],
  'doctors:manage': ['ADMIN'],
  'doctors:schedule': ['ADMIN', 'DOCTOR'],
  'appointments:book': ['ADMIN', 'PATIENT'],
  'appointments:manage': ['ADMIN', 'DOCTOR', 'PATIENT'],
  'appointments:complete': ['ADMIN', 'DOCTOR'],
  'appointments:doctor-view': ['ADMIN', 'DOCTOR'],
  'records:read': ['ADMIN', 'DOCTOR', 'PATIENT'],
  'records:write': ['ADMIN', 'DOCTOR'],
  'prescriptions:create': ['ADMIN', 'DOCTOR'],
  'prescriptions:read': ['ADMIN', 'DOCTOR', 'PHARMACIST', 'PATIENT'],
  'lab:request': ['ADMIN', 'DOCTOR'],
  'lab:process': ['ADMIN', 'LAB_STAFF'],
  'lab:read': ['ADMIN', 'DOCTOR', 'LAB_STAFF', 'PATIENT'],
  'billing:manage': ['ADMIN', 'BILLING_STAFF'],
  'billing:pay': ['ADMIN', 'BILLING_STAFF', 'PATIENT'],
  'billing:read': ['ADMIN', 'BILLING_STAFF', 'PATIENT'],
  'pharmacy:access': ['ADMIN', 'PHARMACIST', 'DOCTOR'],
  'pharmacy:manage': ['ADMIN', 'PHARMACIST'],
  'hospitals:manage': ['ADMIN'],
  'notifications:admin': ['ADMIN'],
  'users:manage': ['ADMIN'],
  'system:monitor': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | undefined, permission: Permission): boolean => !!role && (PERMISSIONS[permission] as readonly Role[]).includes(role);
export const canAny = (role: Role | undefined, ...permissions: Permission[]) => permissions.some((p) => can(role, p));
export const rolesFor = (permission: Permission): readonly Role[] => PERMISSIONS[permission];

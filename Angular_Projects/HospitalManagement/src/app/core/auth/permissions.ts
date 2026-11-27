import type { Role } from '../models';

/** Permission-based authorization on top of the six backend roles (mirrors the backend capability matrix; UI/navigation only). */
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
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role | undefined | null, permission: Permission | string): boolean =>
  !!role && ((PERMISSIONS as Record<string, readonly Role[]>)[permission] ?? []).includes(role);

import type { PermissionKey, RoleKey } from '../models/models';
/**
 * UI-only mirror of the backend's role -> permission table (backend/src/constants/rbac.ts). It only drives navigation and button
 * visibility; the backend still authorises every request.
 */
const ALL: PermissionKey[] = ['user:read', 'user:manage', 'station:manage', 'train:manage', 'train:operate', 'schedule:manage', 'booking:create', 'booking:read-own', 'booking:read-all', 'booking:cancel-any', 'payment:read-all', 'stats:read', 'settings:manage', 'notification:read'];
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  PASSENGER: ['booking:create', 'booking:read-own', 'notification:read'],
  ADMIN: ALL,
  BOOKING_STAFF: ['booking:create', 'booking:read-own', 'booking:read-all', 'booking:cancel-any', 'payment:read-all', 'user:read', 'notification:read', 'stats:read'],
  TRAIN_OPERATOR: ['train:operate', 'schedule:manage', 'stats:read', 'notification:read'],
};
export const ROLE_LABEL: Record<RoleKey, string> = { PASSENGER: 'Passenger', ADMIN: 'Administrator', BOOKING_STAFF: 'Booking Staff', TRAIN_OPERATOR: 'Train Operator' };
export const ROLE_KEYS: RoleKey[] = ['PASSENGER', 'ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'];

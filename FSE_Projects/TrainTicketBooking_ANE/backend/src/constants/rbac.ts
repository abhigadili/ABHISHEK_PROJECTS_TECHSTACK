export const ROLE_KEYS = ['PASSENGER', 'ADMIN', 'BOOKING_STAFF', 'TRAIN_OPERATOR'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];
export const ROLE_LABEL: Record<RoleKey, string> = { PASSENGER: 'Passenger', ADMIN: 'Administrator', BOOKING_STAFF: 'Booking Staff', TRAIN_OPERATOR: 'Train Operator' };

export const PERMISSIONS = {
  'user:read': 'View users', 'user:manage': 'Manage users, status and roles',
  'station:manage': 'Manage stations', 'train:manage': 'Create, edit and delete trains and routes',
  'train:operate': 'Operate trains: status, date availability, coaches, seats', 'schedule:manage': 'Manage schedules',
  'booking:create': 'Book tickets', 'booking:read-own': 'View own bookings', 'booking:read-all': 'View all bookings', 'booking:cancel-any': 'Cancel any booking',
  'payment:read-all': 'View all payments and refunds', 'stats:read': 'View dashboards and reports', 'settings:manage': 'Manage cancellation rules and settings',
  'notification:read': 'Read own notifications',
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as PermissionKey[];
export const ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  PASSENGER: ['booking:create', 'booking:read-own', 'notification:read'],
  ADMIN: ALL,
  BOOKING_STAFF: ['booking:create', 'booking:read-own', 'booking:read-all', 'booking:cancel-any', 'payment:read-all', 'user:read', 'notification:read', 'stats:read'],
  TRAIN_OPERATOR: ['train:operate', 'schedule:manage', 'stats:read', 'notification:read'],
};

/** Roles + permission catalogue shared by server (enforcement) and client (UI hints only). */
export const ROLE_KEYS = ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'PATIENT', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF', 'RECEPTIONIST'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_LABEL: Record<RoleKey, string> = {
  SUPER_ADMIN: 'Super Admin', HOSPITAL_ADMIN: 'Hospital Admin', DOCTOR: 'Doctor', PATIENT: 'Patient',
  LAB_STAFF: 'Laboratory Staff', PHARMACIST: 'Pharmacist', BILLING_STAFF: 'Billing Staff', RECEPTIONIST: 'Receptionist',
};

/** Home page of each role (role-based navigation / redirect after login). */
export const ROLE_HOME: Record<RoleKey, string> = {
  SUPER_ADMIN: '/superadmin', HOSPITAL_ADMIN: '/admin', DOCTOR: '/doctor', PATIENT: '/patient',
  LAB_STAFF: '/lab', PHARMACIST: '/pharmacy', BILLING_STAFF: '/billing', RECEPTIONIST: '/admin',
};

export const PERMISSIONS = {
  'user:manage': 'Manage user accounts and roles',
  'role:manage': 'Manage role permissions',
  'audit:read': 'Read audit logs',
  'hospital:read': 'View hospital information',
  'hospital:manage': 'Create/update hospitals, branches and departments',
  'doctor:read': 'View doctors',
  'doctor:manage': 'Register/update doctors',
  'doctor:availability': 'Manage own availability',
  'patient:read': 'View patient demographics',
  'patient:write': 'Register/update patients',
  'appointment:book': 'Book appointments',
  'appointment:read': 'View appointments',
  'appointment:manage': 'Update appointment status of others',
  'record:read': 'Read medical records',
  'record:write': 'Write medical records',
  'prescription:read': 'View prescriptions',
  'prescription:write': 'Create prescriptions',
  'lab:catalog': 'Manage the laboratory test catalogue',
  'lab:request': 'Request laboratory tests',
  'lab:read': 'View laboratory requests and reports',
  'lab:process': 'Process samples and enter reports',
  'billing:read': 'View invoices and payments',
  'billing:manage': 'Create invoices, refunds',
  'billing:pay': 'Pay own invoices',
  'pharmacy:read': 'View pharmacy catalogue and inventory',
  'pharmacy:manage': 'Manage inventory and dispense',
  'notification:read': 'Read own notifications',
  'report:read': 'View management reports',
} as const;
export type PermissionKey = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as PermissionKey[];
/** Default role → permission assignment written by the seed script (editable at runtime by Super Admin). */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, PermissionKey[]> = {
  SUPER_ADMIN: ALL,
  HOSPITAL_ADMIN: ['user:manage', 'hospital:read', 'hospital:manage', 'doctor:read', 'doctor:manage', 'patient:read', 'patient:write', 'appointment:read', 'appointment:manage', 'appointment:book', 'billing:read', 'lab:read', 'pharmacy:read', 'notification:read', 'report:read', 'prescription:read'],
  DOCTOR: ['hospital:read', 'doctor:read', 'doctor:availability', 'patient:read', 'appointment:read', 'appointment:manage', 'record:read', 'record:write', 'prescription:read', 'prescription:write', 'lab:request', 'lab:read', 'pharmacy:read', 'notification:read'],
  PATIENT: ['hospital:read', 'doctor:read', 'appointment:book', 'appointment:read', 'record:read', 'prescription:read', 'lab:read', 'billing:read', 'billing:pay', 'notification:read'],
  LAB_STAFF: ['hospital:read', 'doctor:read', 'patient:read', 'lab:catalog', 'lab:read', 'lab:process', 'notification:read'],
  PHARMACIST: ['hospital:read', 'patient:read', 'prescription:read', 'pharmacy:read', 'pharmacy:manage', 'notification:read'],
  BILLING_STAFF: ['hospital:read', 'patient:read', 'billing:read', 'billing:manage', 'appointment:read', 'notification:read', 'report:read'],
  RECEPTIONIST: ['hospital:read', 'doctor:read', 'patient:read', 'patient:write', 'appointment:read', 'appointment:book', 'appointment:manage', 'notification:read'],
};

/** Roles bound to one hospital (hospital-level data restriction). */
export const HOSPITAL_SCOPED_ROLES: RoleKey[] = ['HOSPITAL_ADMIN', 'LAB_STAFF', 'PHARMACIST', 'BILLING_STAFF', 'RECEPTIONIST'];

export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  HR_ADMIN = 'HR_ADMIN',
  PAYROLL_ADMIN = 'PAYROLL_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export interface AuthUser {
  userId: string;
  username: string;
  employeeId: string | null;
  roles: string[];
  permissions: string[];
  tokenId?: string;
  issuedAt?: number;
  system?: boolean;
}

export interface PageRequest {
  page: number; // zero-based
  size: number;
  sort?: string;
  dir: 'ASC' | 'DESC';
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type Row = Record<string, any>;
export type Nullable<T> = T | null;

/** Type guard used by authorization helpers. */
export function hasRole(user: AuthUser | undefined, ...roles: string[]): boolean {
  return !!user && (user.roles.includes(Role.SUPER_ADMIN) || roles.some((r) => user.roles.includes(r)));
}
export function hasPermission(user: AuthUser | undefined, ...perms: string[]): boolean {
  return !!user && (user.roles.includes(Role.SUPER_ADMIN) || perms.some((p) => user.permissions.includes(p)));
}

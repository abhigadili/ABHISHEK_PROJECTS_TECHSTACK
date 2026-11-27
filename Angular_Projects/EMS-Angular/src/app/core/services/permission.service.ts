import { Injectable, computed, inject } from '@angular/core';
import { Permission, Role } from '../models/auth.models';
import { AuthService } from './auth.service';

const ADMIN: Permission[] = [
  'employee.write', 'employee.salary.view', 'department.write', 'designation.write', 'attendance.correct', 'attendance.team',
  'leave.approve', 'leave.admin', 'holiday.write', 'report.view', 'report.admin', 'dashboard.view', 'user.manage', 'audit.view',
];

/**
 * Mirrors the backend role matrix (routes use authorize(ADMINS) / authorize(MANAGERS_UP) / authorize(SUPER_ADMIN)).
 * This only drives what the UI SHOWS; the Express API independently enforces every permission.
 */
const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [...ADMIN, 'role.assign'],
  HR_ADMIN: ADMIN,
  MANAGER: ['attendance.team', 'leave.approve', 'report.view', 'dashboard.view'],
  EMPLOYEE: [],
};

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  /** Derived signal: recomputed only when the role changes. */
  readonly permissions = computed<ReadonlySet<Permission>>(() => {
    const role = this.auth.role();
    return new Set(role ? ROLE_PERMISSIONS[role] : []);
  });

  has(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  hasAny(permissions: readonly Permission[]): boolean {
    return permissions.some((p) => this.has(p));
  }

  hasRole(roles: readonly Role[]): boolean {
    const role = this.auth.role();
    return !!role && roles.includes(role);
  }
}

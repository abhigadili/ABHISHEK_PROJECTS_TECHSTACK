export type Role = 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';

export const ALL_ROLES: readonly Role[] = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];

export interface SessionUser {
  id: number;
  username?: string | null;
  email: string;
  role: Role;
  employeeId: number | null;
}

/** The backend accepts the registered username OR the e-mail (one of the two is required). */
export interface LoginRequest {
  email?: string;
  username?: string;
  password: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface LoginResponse extends TokenPair {
  user: SessionUser;
}

export interface EmployeeBrief {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  status: string;
  departmentId: number | null;
  managerId: number | null;
}

export interface CurrentUser {
  id: number;
  username?: string | null;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  employee: EmployeeBrief | null;
}

export interface ForgotPasswordResponse {
  /** Only present when the backend runs with EXPOSE_RESET_TOKEN=true (dev/test). */
  resetToken?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Fine-grained UI permissions derived from the backend role matrix (UI hints only — backend enforces). */
export type Permission =
  | 'employee.write'
  | 'employee.salary.view'
  | 'department.write'
  | 'designation.write'
  | 'attendance.correct'
  | 'attendance.team'
  | 'leave.approve'
  | 'leave.admin'
  | 'holiday.write'
  | 'report.view'
  | 'report.admin'
  | 'dashboard.view'
  | 'user.manage'
  | 'role.assign'
  | 'audit.view';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

export interface RegistrationOptions {
  departments: { id: number; name: string }[];
  designations: { id: number; name: string }[];
}

export interface RegistrationResult {
  id: number;
  employeeId: number;
  employeeCode: string;
  username: string;
  email: string;
  role: Role;
}

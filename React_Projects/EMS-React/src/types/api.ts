import type { Role } from '@/constants/roles';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}
export interface ApiFieldError {
  field: string;
  message: string;
  location?: string;
}

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  employeeId: number | null;
}
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: SessionUser;
}
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  employee: {
    id: number;
    employeeCode: string;
    firstName: string;
    lastName: string;
    workEmail: string;
    status: string;
    departmentId: number | null;
    managerId: number | null;
  } | null;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export interface IdName {
  id: number;
  name: string;
}
export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  status: EmployeeStatus;
  employmentType: EmploymentType;
  designation: IdName | null;
  jobTitle: string | null;
  department: IdName | null;
  team: IdName | null;
  manager: { id: number; employeeCode: string; name: string } | null;
  workLocation: string | null;
  joiningDate: string;
  profilePictureUrl: string | null;
  // present for admins and the employee themself
  personalEmail?: string | null;
  dateOfBirth?: string | null;
  address?: {
    line: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postalCode: string | null;
  };
  emergencyContact?: { name: string | null; phone: string | null; relation: string | null };
  probationEndDate?: string | null;
  exitDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  compensation?: { salary: number | null; salaryCurrency: string | null; bonusTarget: number | null };
  account?: { userId: number; role: Role } | null;
}

export interface EmployeeListQuery {
  page?: number;
  limit?: number;
  q?: string;
  departmentId?: number;
  designationId?: number;
  managerId?: number;
  status?: EmployeeStatus | 'ALL';
  employmentType?: EmploymentType;
  sort?: string;
}

/** Body accepted by POST/PUT /employees. Optional keys are omitted (never null) when empty. */
export interface EmployeePayload {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  joiningDate?: string;
  probationEndDate?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  employmentType?: EmploymentType;
  designationId?: number | null;
  departmentId?: number | null;
  teamId?: number | null;
  managerId?: number | null;
  jobTitle?: string;
  workLocation?: string;
  salary?: number;
  bonusTarget?: number;
  salaryCurrency?: string;
  employeeCode?: string;
  account?: { role: Role; password: string };
  changeType?: ChangeType;
  effectiveDate?: string;
  notes?: string;
}

export type ChangeType =
  'PROMOTION' | 'TRANSFER' | 'MANAGER_CHANGE' | 'JOB_CHANGE' | 'STATUS_CHANGE' | 'PROBATION';
export interface JobHistoryEntry {
  id: number;
  changeType: ChangeType | 'JOINED';
  effectiveDate: string;
  notes: string | null;
  createdAt: string;
  fromJobTitle: string | null;
  toJobTitle: string | null;
  fromDesignation: string | null;
  toDesignation: string | null;
  fromDepartment: string | null;
  toDepartment: string | null;
  fromManager: string | null;
  toManager: string | null;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  headEmployeeId: number | null;
  headName: string | null;
  headcount: number;
  createdAt: string;
  updatedAt: string;
}
export interface DepartmentPayload {
  code?: string;
  name?: string;
  description?: string;
  headEmployeeId?: number | null;
}
export interface Designation {
  id: number;
  name: string;
  description: string | null;
  jobLevel: number;
  isActive: boolean;
  headcount: number;
}
export interface DesignationPayload {
  name?: string;
  description?: string;
  jobLevel?: number;
  isActive?: boolean;
}
export interface Team {
  id: number;
  name: string;
  description: string | null;
  departmentId: number;
  isActive: boolean;
  memberCount: number;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF';
export type WorkMode = 'OFFICE' | 'REMOTE' | 'HYBRID';
export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: IdName | null;
  workDate: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workingHours: number | null;
  status: AttendanceStatus;
  workMode: WorkMode | null;
  remarks: string | null;
  correction: unknown;
}
export interface AttendanceQuery {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  employeeId?: number;
  departmentId?: number;
  status?: AttendanceStatus;
}
export interface AttendanceSummary {
  from: string;
  to: string;
  byStatus: Partial<Record<AttendanceStatus, number>>;
  totalRecords: number;
  totalHours: number;
}
export interface AttendanceCorrection {
  checkInAt?: string;
  checkOutAt?: string;
  status?: AttendanceStatus;
  workMode?: WorkMode;
  remarks?: string;
  reason: string;
}
export interface MonthlyAttendanceRow {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  present: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weeklyOff: number;
  totalHours: number;
}
export interface DepartmentAttendanceRow {
  departmentId: number;
  department: string;
  headcount: number;
  present: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  totalHours: number;
  daysWithRecords: number;
}
export type CalendarDayType = 'WORKING_DAY' | 'WEEKLY_OFF' | 'HOLIDAY';
export interface AttendanceCalendar {
  employeeId: number;
  from: string;
  to: string;
  days: {
    date: string;
    recorded: AttendanceRecord | { status: AttendanceStatus } | null;
    calendarDayType: CalendarDayType;
    holidayName: string | null;
  }[];
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DayPart = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
export interface LeavePolicy {
  annualEntitlement: number;
  carryForwardMax: number;
  allowHalfDay: boolean;
  maxConsecutiveDays: number | null;
}
export interface LeaveType {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isPaid: boolean;
  requiresDocument: boolean;
  isActive: boolean;
  policy: LeavePolicy | null;
}
export interface LeaveBalance {
  leaveTypeId: number;
  leaveTypeCode: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  adjusted: number;
  used: number;
  available: number;
}
export interface LeaveBalances {
  employeeId: number;
  year: number;
  balances: LeaveBalance[];
}
export interface LeaveRequest {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveType: { id: number; code: string; name: string };
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  days: number;
  reason: string;
  status: LeaveStatus;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  documentCount: number;
  createdAt: string;
  /** only on GET /leave/requests/:id */
  documents?: { id: number; fileName: string; mimeType: string; sizeBytes: number; createdAt: string }[];
}
export interface LeaveApplication {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  reason: string;
}
export interface LeaveListQuery {
  page?: number;
  limit?: number;
  status?: LeaveStatus;
  from?: string;
  to?: string;
  employeeId?: number;
  leaveTypeId?: number;
  departmentId?: number;
}
export interface LeaveHistory {
  employeeId: number;
  year: number;
  requests: LeaveRequest[];
  ledger: {
    id: number;
    type: string;
    amount: number;
    note: string | null;
    leaveRequestId: number | null;
    createdAt: string;
    leaveTypeCode: string;
  }[];
}
export interface LeaveCalendar {
  from: string;
  to: string;
  holidays: Holiday[];
  weeklyOffDays: number[];
  leaves: LeaveRequest[];
}
export interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  location: string;
  isOptional: boolean;
}
export interface WeeklyOff {
  id: number;
  location: string;
  dayOfWeek: number;
}

export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  refType: string | null;
  refId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardData {
  asOf: string;
  employees: { total: number; active: number; inactive: number };
  headcountByDepartment: { departmentId: number; department: string; headcount: number }[];
  attendanceToday: Partial<Record<AttendanceStatus, number>>;
  onLeaveToday: number;
  leaveThisYear: Partial<Record<LeaveStatus, { requests: number; days: number }>>;
  pendingLeaveApprovals: number;
  upcomingBirthdays: EventPerson[];
  upcomingAnniversaries: EventPerson[];
}
export interface EventPerson {
  employeeId: number;
  employeeCode: string;
  name: string;
  date: string;
  years?: number;
}

export interface OrgNode {
  id: number;
  employeeCode: string;
  name: string;
  workEmail: string;
  designation: string | null;
  jobTitle: string | null;
  department: IdName | null;
  managerId: number | null;
  profilePictureUrl: string | null;
  directReportCount: number;
  subordinates: OrgNode[];
}
export interface OrgChart {
  roots: OrgNode[];
  totalNodes: number;
}
export interface OrgSearchHit extends Omit<OrgNode, 'directReportCount' | 'subordinates'> {
  depth: number;
  managerChainIds: number[];
}
export interface ReportingChain {
  employee: Omit<OrgNode, 'directReportCount' | 'subordinates'>;
  chain: (Omit<OrgNode, 'directReportCount' | 'subordinates'> & { level: number })[];
}

export interface JoinersExits {
  from: string;
  to: string;
  joiners: {
    employeeCode: string;
    name: string;
    department: string | null;
    date: string;
    employmentType: string;
  }[];
  exits: { employeeCode: string; name: string; department: string | null; date: string }[];
}
export interface LeaveBalanceReport {
  year: number;
  rows: {
    employeeCode: string;
    name: string;
    department: string | null;
    leaveType: string;
    entitled: number;
    adjusted: number;
    used: number;
    available: number;
  }[];
}
export interface LeaveSummaryReport {
  from: string;
  to: string;
  rows: Record<string, string | number | null>[];
}
export interface DepartmentReportRow {
  code: string;
  name: string;
  head: string | null;
  isActive: boolean;
  activeEmployees: number;
  inactiveEmployees: number;
  teams: number;
}
export interface DesignationReportRow {
  name: string;
  jobLevel: number;
  isActive: boolean;
  activeEmployees: number;
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export interface RegistrationOptions {
  departments: IdName[];
  designations: IdName[];
}
export interface RegistrationResult {
  id: number;
  employeeId: number;
  employeeCode: string;
  username: string;
  email: string;
  role: Role;
}

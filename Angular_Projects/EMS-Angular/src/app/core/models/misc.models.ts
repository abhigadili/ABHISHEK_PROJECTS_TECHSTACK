import { AttendanceStatus } from './attendance.models';
import { LeaveStatus } from './leave.models';

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

export interface UpcomingEvent {
  employeeId: number;
  employeeCode: string;
  name: string;
  date: string;
}

export interface DashboardData {
  asOf: string;
  employees: { total: number; active: number; inactive: number };
  headcountByDepartment: { departmentId: number | null; department: string | null; headcount: number }[];
  attendanceToday: Partial<Record<AttendanceStatus, number>>;
  onLeaveToday: number;
  leaveThisYear: Partial<Record<LeaveStatus, { requests: number; days: number }>>;
  pendingLeaveApprovals: number;
  upcomingBirthdays: UpcomingEvent[];
  upcomingAnniversaries: (UpcomingEvent & { years?: number })[];
}

export interface UpcomingEvents {
  birthdays: UpcomingEvent[];
  anniversaries: (UpcomingEvent & { years?: number })[];
}

export interface JoinerExitRow {
  employeeCode: string;
  name: string;
  department: string | null;
  date: string;
  employmentType?: string;
}

export interface JoinersExitsReport {
  from: string;
  to: string;
  joiners: JoinerExitRow[];
  exits: JoinerExitRow[];
}

export interface LeaveBalanceReportRow {
  employeeCode: string;
  name: string;
  department: string | null;
  leaveType: string;
  entitled: number;
  adjusted: number;
  used: number;
  available: number;
}

export interface LeaveBalanceReport {
  year: number;
  rows: LeaveBalanceReportRow[];
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
  jobLevel: number | null;
  isActive: boolean;
  activeEmployees: number;
}

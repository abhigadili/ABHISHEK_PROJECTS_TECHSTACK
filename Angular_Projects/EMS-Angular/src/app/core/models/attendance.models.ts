import { IdName } from './employee.models';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF';
export type WorkMode = 'OFFICE' | 'REMOTE' | 'HYBRID';

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKLY_OFF'];
export const WORK_MODES: readonly WorkMode[] = ['OFFICE', 'REMOTE', 'HYBRID'];

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
  correction: { reason?: string; correctedBy?: string; correctedAt?: string } | null;
}

export interface AttendanceFilters {
  from?: string | null;
  to?: string | null;
  employeeId?: number | null;
  departmentId?: number | null;
  status?: AttendanceStatus | null;
  page?: number;
  limit?: number;
}

export interface AttendanceSummary {
  from: string;
  to: string;
  byStatus: Partial<Record<AttendanceStatus, number>>;
  totalRecords: number;
  totalHours: number;
}

export interface AttendanceCorrection {
  checkInAt?: string | null;
  checkOutAt?: string | null;
  status?: AttendanceStatus;
  workMode?: WorkMode;
  remarks?: string | null;
  reason: string;
}

export interface ManualAttendance extends AttendanceCorrection {
  employeeId: number;
  workDate: string;
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

export interface MonthlyAttendanceReport {
  year: number;
  month: number;
  from: string;
  to: string;
  rows: MonthlyAttendanceRow[];
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

export interface DepartmentAttendanceReport {
  from: string;
  to: string;
  rows: DepartmentAttendanceRow[];
}

export interface AttendanceCalendarDay {
  date: string;
  recorded: { status: AttendanceStatus; checkInAt: string | null; checkOutAt: string | null } | null;
  calendarDayType: 'WORKING_DAY' | 'WEEKLY_OFF' | 'HOLIDAY';
  holidayName: string | null;
}

export interface AttendanceCalendar {
  employeeId: number;
  from: string;
  to: string;
  days: AttendanceCalendarDay[];
}

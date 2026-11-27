export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type DayPart = 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';

export const LEAVE_STATUSES: readonly LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
export const DAY_PARTS: readonly DayPart[] = ['FULL_DAY', 'FIRST_HALF', 'SECOND_HALF'];

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

export interface LeaveTypeWriteRequest {
  code?: string;
  name?: string;
  description?: string | null;
  isPaid?: boolean;
  requiresDocument?: boolean;
  isActive?: boolean;
  policy?: LeavePolicy | null;
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

export interface LeaveDocument {
  id: number;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
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
  decidedBy: string | number | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cancelledAt: string | null;
  documentCount: number;
  createdAt: string;
  documents?: LeaveDocument[];
}

export interface LeaveApplyRequest {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  dayPart?: DayPart;
  reason: string;
}

export interface LeaveListFilters {
  status?: LeaveStatus | null;
  from?: string | null;
  to?: string | null;
  employeeId?: number | null;
  leaveTypeId?: number | null;
  departmentId?: number | null;
  page?: number;
  limit?: number;
}

export interface LeaveHistory {
  employeeId: number;
  year: number;
  requests: LeaveRequest[];
}

export interface BalanceAdjustRequest {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  amount: number;
  note: string;
}

export interface CalendarLeave {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  dayPart: DayPart;
  status: LeaveStatus;
}

export interface Holiday {
  id: number;
  holidayDate: string;
  name: string;
  location: string;
  isOptional: boolean;
}

export interface HolidayWriteRequest {
  holidayDate?: string;
  name?: string;
  location?: string;
  isOptional?: boolean;
}

export interface WeeklyOff {
  id: number;
  location: string;
  dayOfWeek: number;
}

export interface LeaveCalendar {
  from: string;
  to: string;
  holidays: Holiday[];
  weeklyOffDays: number[];
  leaves: CalendarLeave[];
}

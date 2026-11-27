import type { RootState } from '@/app/store/store';

export const selectLeaveStatusFilter = (s: RootState) => s.leave.statusFilter;
export const selectLeaveYear = (s: RootState) => s.leave.year;
export const selectCalendarMonth = (s: RootState) => s.leave.calendar;

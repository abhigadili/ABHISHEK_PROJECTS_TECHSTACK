import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { LeaveStatus } from '@/types/api';

/** Client-side leave UI state shared between the history, approvals and calendar screens. Leave DATA is RTK Query. */
export interface LeaveUiState {
  statusFilter: LeaveStatus | 'ALL';
  year: number;
  calendar: { year: number; month: number };
}
const now = new Date();
export const initialLeaveState: LeaveUiState = {
  statusFilter: 'ALL',
  year: now.getFullYear(),
  calendar: { year: now.getFullYear(), month: now.getMonth() + 1 },
};

const leaveSlice = createSlice({
  name: 'leave',
  initialState: initialLeaveState,
  reducers: {
    setLeaveStatusFilter(s, a: PayloadAction<LeaveStatus | 'ALL'>) {
      s.statusFilter = a.payload;
    },
    setLeaveYear(s, a: PayloadAction<number>) {
      s.year = a.payload;
    },
    shiftCalendarMonth(s, a: PayloadAction<number>) {
      const d = new Date(s.calendar.year, s.calendar.month - 1 + a.payload, 1);
      s.calendar = { year: d.getFullYear(), month: d.getMonth() + 1 };
    },
    setCalendarMonth(s, a: PayloadAction<{ year: number; month: number }>) {
      s.calendar = a.payload;
    },
  },
});
export const { setLeaveStatusFilter, setLeaveYear, shiftCalendarMonth, setCalendarMonth } =
  leaveSlice.actions;
export default leaveSlice.reducer;

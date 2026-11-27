import 'server-only';
import { z } from 'zod';
import { apiFetch, apiPaged } from './api-client';
import { attendanceSchema, type AttendanceRecord } from '@/schemas/api';

export interface AttendanceQuery { page?: number; limit?: number; from?: string; to?: string; status?: string; employeeId?: number; departmentId?: number }
export const listAttendance = (scope: 'me' | 'all', q: AttendanceQuery) =>
  apiPaged<AttendanceRecord>(scope === 'me' ? '/attendance/me' : '/attendance', { query: { ...q }, schema: z.array(attendanceSchema) });
export const getAttendance = (id: number) => apiFetch(`/attendance/${id}`, { schema: attendanceSchema }).then((r) => r.data);
export const checkIn = (workMode?: string) => apiFetch('/attendance/check-in', { method: 'POST', body: workMode ? { workMode } : {}, schema: attendanceSchema }).then((r) => r.data);
export const checkOut = () => apiFetch('/attendance/check-out', { method: 'POST', body: {}, schema: attendanceSchema }).then((r) => r.data);
export const correctAttendance = (id: number, body: Record<string, unknown>) => apiFetch(`/attendance/${id}`, { method: 'PUT', body, schema: attendanceSchema }).then((r) => r.data);
export const attendanceSummary = (q: { from?: string; to?: string; employeeId?: number }) =>
  apiFetch('/attendance/summary', { query: q, schema: z.object({ from: z.string(), to: z.string(), byStatus: z.record(z.string(), z.number()), totalRecords: z.number(), totalHours: z.number() }) }).then((r) => r.data);
export const monthlyAttendance = (year: number, month: number, departmentId?: number) =>
  apiFetch('/attendance/reports/monthly', {
    query: { year, month, departmentId },
    schema: z.object({ rows: z.array(z.object({ employeeId: z.number(), employeeCode: z.string(), employeeName: z.string(), department: z.string().nullable(), present: z.number(), halfDay: z.number(), absent: z.number(), onLeave: z.number(), totalHours: z.number() }).passthrough()) }),
  }).then((r) => r.data.rows);
export const attendanceCalendar = (year: number, month: number) =>
  apiFetch('/calendar/attendance', {
    query: { year, month },
    schema: z.object({ days: z.array(z.object({ date: z.string(), calendarDayType: z.string(), holidayName: z.string().nullable(), recorded: z.object({ status: z.string() }).passthrough().nullable() })) }),
  }).then((r) => r.data.days);

import 'server-only';
import { z } from 'zod';
import { apiFetch } from './api-client';
import { holidaySchema, type Holiday } from '@/schemas/api';

// Company holidays: same for everybody and rarely edited → Data Cache with tag `holidays` (invalidated by the holiday actions).
export const getHolidays = (year: number): Promise<Holiday[]> =>
  apiFetch('/holidays', { query: { from: `${year}-01-01`, to: `${year}-12-31` }, schema: z.array(holidaySchema), cache: { revalidate: 600, tags: ['holidays'] } }).then((r) => r.data);
export const createHoliday = (body: Record<string, unknown>) => apiFetch('/holidays', { method: 'POST', body, schema: holidaySchema }).then((r) => r.data);
export const deleteHoliday = (id: number) => apiFetch(`/holidays/${id}`, { method: 'DELETE' });
export const getWeeklyOffs = () => apiFetch('/weekly-offs', { schema: z.array(z.object({ id: z.number(), location: z.string(), dayOfWeek: z.number() })), cache: { revalidate: 600, tags: ['holidays'] } }).then((r) => r.data);
export const leaveCalendar = (year: number, month: number) =>
  apiFetch('/calendar/leave', { query: { year, month }, schema: z.object({ weeklyOffDays: z.array(z.number()), holidays: z.array(holidaySchema), leaves: z.array(z.object({ id: z.number(), employeeName: z.string(), startDate: z.string(), endDate: z.string(), status: z.string() }).passthrough()) }) }).then((r) => r.data);

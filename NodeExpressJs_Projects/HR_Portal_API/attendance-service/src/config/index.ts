import { env, envInt } from '@hr/common';

export const attendanceConfig = {
  port: envInt('ATTENDANCE_SERVICE_PORT', 31105),
  database: env('ATTENDANCE_DB', 'hr_attendance_db'),
  /** Office wall-clock offset from UTC in minutes (IST = 330). DATETIME columns hold UTC (same as the Java service). */
  officeOffsetMinutes: envInt('OFFICE_TZ_OFFSET_MINUTES', 330),
  summaryTtl: 300,
};

export const toOffice = (d: Date): Date => new Date(d.getTime() + attendanceConfig.officeOffsetMinutes * 60000);
export const officeDate = (d: Date = new Date()): string => toOffice(d).toISOString().slice(0, 10);
export const officeMinuteOfDay = (d: Date): number => { const o = toOffice(d); return o.getUTCHours() * 60 + o.getUTCMinutes(); };
/** 'HH:MM:SS(.ffffff)' -> minutes since midnight */
export const timeToMinutes = (t: string): number => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
/** Office wall-clock date + minutes -> UTC Date */
export const fromOffice = (date: string, minutes: number): Date => new Date(new Date(`${date}T00:00:00Z`).getTime() + (minutes - attendanceConfig.officeOffsetMinutes) * 60000);

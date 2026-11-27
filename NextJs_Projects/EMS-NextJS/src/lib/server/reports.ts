import 'server-only';
import { z } from 'zod';
import { apiFetch, apiFetchRaw } from './api-client';

const dept = z.array(z.object({ code: z.string(), name: z.string(), head: z.string().nullable(), isActive: z.boolean(), activeEmployees: z.number(), inactiveEmployees: z.number(), teams: z.number() }));
const desig = z.array(z.object({ name: z.string(), jobLevel: z.number(), isActive: z.boolean(), activeEmployees: z.number() }));
const joiners = z.object({ from: z.string(), to: z.string(), joiners: z.array(z.object({ employeeCode: z.string(), name: z.string(), department: z.string().nullable(), date: z.string(), employmentType: z.string() })), exits: z.array(z.object({ employeeCode: z.string(), name: z.string(), department: z.string().nullable(), date: z.string() })) });
const leaveSummary = z.object({ from: z.string(), to: z.string(), rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))) });

export const departmentsReport = () => apiFetch('/reports/departments', { schema: dept }).then((r) => r.data);
export const designationsReport = () => apiFetch('/reports/designations', { schema: desig }).then((r) => r.data);
export const joinersExitsReport = (from?: string, to?: string) => apiFetch('/reports/joiners-exits', { query: { from, to }, schema: joiners }).then((r) => r.data);
export const leaveSummaryReport = (from?: string, to?: string) => apiFetch('/reports/leave-summary', { query: { from, to }, schema: leaveSummary }).then((r) => r.data);

/** Backend path allow-list for CSV exports → used by the CSV route handler so it can never proxy arbitrary backend URLs. */
export const CSV_REPORTS = {
  departments: '/reports/departments',
  designations: '/reports/designations',
  'leave-balances': '/reports/leave-balances',
  'attendance-monthly': '/attendance/reports/monthly',
  'attendance-department': '/attendance/reports/department',
} as const;
export type CsvReport = keyof typeof CSV_REPORTS;
export const fetchCsv = (name: CsvReport, query: Record<string, string | undefined>) => apiFetchRaw(CSV_REPORTS[name], { query: { ...query, format: 'csv' } });

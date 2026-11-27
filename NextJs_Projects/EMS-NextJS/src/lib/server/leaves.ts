import 'server-only';
import { z } from 'zod';
import { apiFetch, apiFetchRaw, apiPaged } from './api-client';
import { leaveBalancesSchema, leaveRequestSchema, leaveTypeSchema, type LeaveRequest, type LeaveType } from '@/schemas/api';

export interface LeaveQuery { page?: number; limit?: number; status?: string; from?: string; to?: string; employeeId?: number }

// Leave TYPES are policy reference data (not per-user) → Data Cache, tag `leave-types`.
export const getLeaveTypes = (): Promise<LeaveType[]> =>
  apiFetch('/leave/types', { schema: z.array(leaveTypeSchema), cache: { revalidate: 300, tags: ['leave-types'] } }).then((r) => r.data);
// Balances, requests and approvals are PER-USER and sensitive → never cached.
export const getBalances = (year?: number) => apiFetch('/leave/balances', { query: { year }, schema: leaveBalancesSchema }).then((r) => r.data);
export const listLeaves = (scope: 'me' | 'all' | 'pending', q: LeaveQuery) =>
  apiPaged<LeaveRequest>(scope === 'me' ? '/leave/requests/me' : scope === 'pending' ? '/leave/requests/pending-approvals' : '/leave/requests', { query: { ...q }, schema: z.array(leaveRequestSchema) });
export const getLeave = (id: number) => apiFetch(`/leave/requests/${id}`, { schema: leaveRequestSchema }).then((r) => r.data);
export const applyLeave = (body: Record<string, unknown>) => apiFetch('/leave/requests', { method: 'POST', body, schema: leaveRequestSchema }).then((r) => r.data);
export const decideLeave = (id: number, action: 'approve' | 'reject', note?: string) => apiFetch(`/leave/requests/${id}/${action}`, { method: 'POST', body: note ? { note } : {}, schema: leaveRequestSchema }).then((r) => r.data);
export const cancelLeave = (id: number) => apiFetch(`/leave/requests/${id}/cancel`, { method: 'POST', body: {}, schema: leaveRequestSchema }).then((r) => r.data);
export const uploadLeaveDocument = (id: number, form: FormData) => apiFetch(`/leave/requests/${id}/documents`, { method: 'POST', body: form });
export const downloadLeaveDocument = (id: number, docId: number) => apiFetchRaw(`/leave/requests/${id}/documents/${docId}`);
export const leaveHistory = (employeeId: number, year?: number) =>
  apiFetch(`/leave/history/employees/${employeeId}`, { query: { year }, schema: z.object({ requests: z.array(leaveRequestSchema) }) }).then((r) => r.data.requests);
export const teamLeave = (from?: string, to?: string) => apiFetch('/leave/team', { query: { from, to }, schema: z.array(leaveRequestSchema) }).then((r) => r.data);
export const adjustBalance = (body: Record<string, unknown>) => apiFetch('/leave/balances/adjust', { method: 'POST', body });
export const createLeaveType = (body: Record<string, unknown>) => apiFetch('/leave/types', { method: 'POST', body, schema: leaveTypeSchema }).then((r) => r.data);
export const updateLeaveType = (id: number, body: Record<string, unknown>) => apiFetch(`/leave/types/${id}`, { method: 'PUT', body, schema: leaveTypeSchema }).then((r) => r.data);

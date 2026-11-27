import 'server-only';
import { apiFetch, apiFetchRaw, apiPaged } from './api-client';
import { employeeSchema, jobHistorySchema, type Employee } from '@/schemas/api';
import { getDepartments } from './departments';
import { z } from 'zod';

export interface EmployeeQuery { page?: number; limit?: number; search?: string; department?: string; designationId?: number; status?: string; sort?: string; managerId?: number }

/** `department` may be an id, a code (IT) or a name — resolved against the (cached) department list. */
async function resolveDepartmentId(dept?: string): Promise<number | undefined> {
  if (!dept) return undefined;
  if (/^\d+$/.test(dept)) return Number(dept);
  const list = await getDepartments();
  const d = list.find((x) => x.code.toLowerCase() === dept.toLowerCase() || x.name.toLowerCase() === dept.toLowerCase());
  return d?.id ?? -1; // unknown → matches nothing instead of silently ignoring the filter
}

export async function listEmployees(q: EmployeeQuery) {
  const departmentId = await resolveDepartmentId(q.department);
  return apiPaged<Employee>('/employees', {
    schema: z.array(employeeSchema),
    query: { page: q.page, limit: q.limit, q: q.search, departmentId, designationId: q.designationId, managerId: q.managerId, status: q.status, sort: q.sort },
  });
}
export const getEmployee = (id: number) => apiFetch(`/employees/${id}`, { schema: employeeSchema }).then((r) => r.data);
export const getJobHistory = (id: number) => apiFetch(`/employees/${id}/job-history`, { schema: z.array(jobHistorySchema) }).then((r) => r.data);
export const createEmployee = (body: Record<string, unknown>) => apiFetch('/employees', { method: 'POST', body, schema: employeeSchema }).then((r) => r.data);
export const updateEmployee = (id: number, body: Record<string, unknown>) => apiFetch(`/employees/${id}`, { method: 'PUT', body, schema: employeeSchema }).then((r) => r.data);
export const patchEmployee = (id: number, body: Record<string, unknown>) => apiFetch(`/employees/${id}`, { method: 'PATCH', body, schema: employeeSchema }).then((r) => r.data);
export const deactivateEmployee = (id: number, reason?: string) => apiFetch(`/employees/${id}/deactivate`, { method: 'POST', body: { reason } });
export const reactivateEmployee = (id: number) => apiFetch(`/employees/${id}/reactivate`, { method: 'POST' });
export const addJobHistory = (id: number, body: Record<string, unknown>) => apiFetch(`/employees/${id}/job-history`, { method: 'POST', body });
export const createAccount = (id: number, body: { role: string; password: string }) => apiFetch(`/employees/${id}/account`, { method: 'POST', body });
export const setRole = (id: number, role: string) => apiFetch(`/employees/${id}/role`, { method: 'PUT', body: { role } });
export const getPicture = (id: number) => apiFetchRaw(`/employees/${id}/picture`);
export const putPicture = (id: number, form: FormData) => apiFetch(`/employees/${id}/picture`, { method: 'PUT', body: form });
export const putMyPicture = (form: FormData) => apiFetch('/profile/picture', { method: 'PUT', body: form });
export const getMyProfile = () => apiFetch('/profile', { schema: employeeSchema }).then((r) => r.data);
export const patchMyProfile = (body: Record<string, unknown>) => apiFetch('/profile', { method: 'PATCH', body, schema: employeeSchema }).then((r) => r.data);

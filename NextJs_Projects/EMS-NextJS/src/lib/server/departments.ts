import 'server-only';
import { apiFetch, apiPaged } from './api-client';
import { departmentSchema, designationSchema, type Department, type Designation } from '@/schemas/api';
import { z } from 'zod';

/**
 * CACHING DECISION (docs/nextjs-caching-strategy.md): department and designation lists are org-wide reference data that change rarely.
 * They opt in to the Data Cache (`revalidate: 300`, tags `departments` / `designations`) and are invalidated by `revalidateTag` after
 * any create/update. NOTE: the request carries a Bearer token, and Next includes request headers in the cache key, so entries are
 * per-session; that is the safe default for authenticated data (no cross-user sharing is ever assumed).
 */
export const getDepartments = async (): Promise<Department[]> =>
  (await apiPaged<Department>('/departments', { query: { limit: 100 }, schema: z.array(departmentSchema), cache: { revalidate: 300, tags: ['departments'] } })).items;
export const getDesignations = async (): Promise<Designation[]> =>
  (await apiPaged<Designation>('/designations', { query: { limit: 100 }, schema: z.array(designationSchema), cache: { revalidate: 300, tags: ['designations'] } })).items;

// Details/search are per-request (counts and heads change with every employee edit)
export const listDepartments = (q: { search?: string; page?: number; limit?: number; isActive?: boolean }) =>
  apiPaged<Department>('/departments', { query: { q: q.search, page: q.page, limit: q.limit, isActive: q.isActive }, schema: z.array(departmentSchema) });
export const getDepartment = (id: number) => apiFetch(`/departments/${id}`, { schema: departmentSchema }).then((r) => r.data);
export const createDepartment = (body: Record<string, unknown>) => apiFetch('/departments', { method: 'POST', body, schema: departmentSchema }).then((r) => r.data);
export const updateDepartment = (id: number, body: Record<string, unknown>) => apiFetch(`/departments/${id}`, { method: 'PUT', body, schema: departmentSchema }).then((r) => r.data);
export const setDepartmentActive = (id: number, active: boolean) => (active ? apiFetch(`/departments/${id}/activate`, { method: 'POST' }) : apiFetch(`/departments/${id}`, { method: 'DELETE' }));
export const createDesignation = (body: Record<string, unknown>) => apiFetch('/designations', { method: 'POST', body, schema: designationSchema }).then((r) => r.data);
export const updateDesignation = (id: number, body: Record<string, unknown>) => apiFetch(`/designations/${id}`, { method: 'PUT', body, schema: designationSchema }).then((r) => r.data);

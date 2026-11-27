import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import { CACHE_TAGS } from '@/constants/cache';
import type { Department, DepartmentInput, Hospital, HospitalInput } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const hospitalService = {
  list: () => backendFetch<Hospital[]>('/api/hospitals', { revalidate: 60, tags: [CACHE_TAGS.hospitals] }),
  get: (id: number) => backendFetch<Hospital>(`/api/hospitals/${id}`, { revalidate: 60, tags: [CACHE_TAGS.hospitals] }),
  departments: (hospitalId: number) => backendFetch<Department[]>(`/api/hospitals/${hospitalId}/departments`, { revalidate: 60, tags: [CACHE_TAGS.departments] }),
  create: (b: HospitalInput) => backendFetch<Hospital>('/api/hospitals', { method: 'POST', body: b, ...A }),
  update: (id: number, b: HospitalInput) => backendFetch<Hospital>(`/api/hospitals/${id}`, { method: 'PUT', body: b, ...A }),
  createDepartment: (hospitalId: number, b: DepartmentInput) => backendFetch<Department>(`/api/hospitals/${hospitalId}/departments`, { method: 'POST', body: b, ...A }),
  deleteDepartment: (id: number) => backendFetch<void>(`/api/departments/${id}`, { method: 'DELETE', ...A }),
};

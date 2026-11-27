import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import { CACHE_TAGS } from '@/constants/cache';
import type { Page, Patient, PatientInput } from '@/types';

/** Patient data is personal health data => never stored in the shared data cache (`no-store`). */
export const patientService = {
  list: (p: { q?: string; page?: number; size?: number } = {}) => backendFetch<Page<Patient>>('/api/patients', { query: { page: 0, size: 20, ...p }, cache: 'no-store' }),
  get: (id: number) => backendFetch<Patient>(`/api/patients/${id}`, { cache: 'no-store' }),
  byUser: (userId: number) => backendFetch<Patient>(`/api/patients/by-user/${userId}/profile`, { cache: 'no-store' }),
  create: (b: PatientInput) => backendFetch<Patient>('/api/patients', { method: 'POST', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  update: (id: number, b: PatientInput) => backendFetch<Patient>(`/api/patients/${id}`, { method: 'PUT', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  deactivate: (id: number) => backendFetch<void>(`/api/patients/${id}`, { method: 'DELETE', cache: 'no-store', redirectOnUnauthorized: false }),
  tags: CACHE_TAGS.patients,
};

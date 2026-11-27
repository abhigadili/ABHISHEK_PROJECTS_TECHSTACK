import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import { CACHE_TAGS } from '@/constants/cache';
import type { AvailableDoctor, Doctor, DoctorInput, DoctorListParams, Page, ScheduleDay, Slot, Unavailability } from '@/types';

/** Doctor reference data is not sensitive: cached per session for 60s and tagged so updates can revalidate it. */
export const doctorService = {
  list: (p: DoctorListParams = {}) => backendFetch<Page<Doctor>>('/api/doctors', { query: { size: 50, ...p }, revalidate: 60, tags: [CACHE_TAGS.doctors] }),
  get: (id: number) => backendFetch<Doctor>(`/api/doctors/${id}`, { revalidate: 60, tags: [CACHE_TAGS.doctors] }),
  specializations: () => backendFetch<string[]>('/api/doctors/specializations', { revalidate: 600, tags: [CACHE_TAGS.doctors] }),
  available: (date: string, specialization?: string) => backendFetch<AvailableDoctor[]>('/api/doctors/available', { query: { date, specialization }, cache: 'no-store' }),
  slots: (id: number, date: string) => backendFetch<Slot[]>(`/api/doctors/${id}/slots`, { query: { date }, cache: 'no-store' }),
  schedule: (id: number) => backendFetch<ScheduleDay[]>(`/api/doctors/${id}/schedule`, { revalidate: 60, tags: [CACHE_TAGS.doctorSchedule(id)] }),
  unavailability: (id: number) => backendFetch<Unavailability[]>(`/api/doctors/${id}/unavailability`, { revalidate: 60, tags: [CACHE_TAGS.doctorSchedule(id)] }),
  create: (b: DoctorInput) => backendFetch<Doctor>('/api/doctors', { method: 'POST', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  update: (id: number, b: DoctorInput) => backendFetch<Doctor>(`/api/doctors/${id}`, { method: 'PUT', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  putSchedule: (id: number, days: ScheduleDay[]) => backendFetch<unknown>(`/api/doctors/${id}/schedule`, { method: 'PUT', body: { days }, cache: 'no-store', redirectOnUnauthorized: false }),
  addUnavailability: (id: number, b: { date: string; reason?: string }) => backendFetch<Unavailability>(`/api/doctors/${id}/unavailability`, { method: 'POST', body: b, cache: 'no-store', redirectOnUnauthorized: false }),
  removeUnavailability: (id: number, uid: number) => backendFetch<void>(`/api/doctors/${id}/unavailability/${uid}`, { method: 'DELETE', cache: 'no-store', redirectOnUnauthorized: false }),
};

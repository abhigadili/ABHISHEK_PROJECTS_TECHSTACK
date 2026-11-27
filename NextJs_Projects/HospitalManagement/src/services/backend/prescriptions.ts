import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import type { Prescription, PrescriptionInput } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const prescriptionService = {
  get: (id: number) => backendFetch<Prescription>(`/api/prescriptions/${id}`, { cache: 'no-store' }),
  byPatient: (patientId: number) => backendFetch<Prescription[]>(`/api/prescriptions/patient/${patientId}`, { cache: 'no-store' }),
  byDoctor: (doctorId: number) => backendFetch<Prescription[]>(`/api/prescriptions/doctor/${doctorId}`, { cache: 'no-store' }),
  create: (b: PrescriptionInput) => backendFetch<Prescription>('/api/prescriptions', { method: 'POST', body: b, ...A }),
  cancel: (id: number) => backendFetch<Prescription>(`/api/prescriptions/${id}/cancel`, { method: 'PUT', ...A }),
};

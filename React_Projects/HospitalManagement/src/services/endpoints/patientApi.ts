import { http } from '@/services/api/http';
import type { Page, Patient, PatientInput, PatientListParams } from '@/types';

export const patientApi = {
  list: (params: PatientListParams, signal?: AbortSignal) => http.get<Page<Patient>>('/patients', { ...params }, signal),
  get: (id: number, signal?: AbortSignal) => http.get<Patient>(`/patients/${id}`, undefined, signal),
  byUserProfile: (userId: number, signal?: AbortSignal) => http.get<Patient>(`/patients/by-user/${userId}/profile`, undefined, signal),
  create: (body: PatientInput) => http.post<Patient>('/patients', body),
  update: (id: number, body: PatientInput) => http.put<Patient>(`/patients/${id}`, body),
  deactivate: (id: number) => http.delete(`/patients/${id}`),
};

import { http } from '@/services/api/http';
import type { Prescription, PrescriptionInput, PrescriptionStatusResponse } from '@/types';

export const prescriptionApi = {
  get: (id: number, signal?: AbortSignal) => http.get<Prescription>(`/prescriptions/${id}`, undefined, signal),
  status: (id: number, signal?: AbortSignal) => http.get<PrescriptionStatusResponse>(`/prescriptions/${id}/status`, undefined, signal),
  forPatient: (patientId: number, signal?: AbortSignal) => http.get<Prescription[]>(`/prescriptions/patient/${patientId}`, undefined, signal),
  forDoctor: (doctorId: number, signal?: AbortSignal) => http.get<Prescription[]>(`/prescriptions/doctor/${doctorId}`, undefined, signal),
  create: (body: PrescriptionInput) => http.post<Prescription>('/prescriptions', body),
  cancel: (id: number) => http.put<Prescription>(`/prescriptions/${id}/cancel`),
};

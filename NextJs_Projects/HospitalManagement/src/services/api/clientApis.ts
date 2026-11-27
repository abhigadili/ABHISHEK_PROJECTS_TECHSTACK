import { http, unwrap } from './client';
import type { Appointment, AvailableDoctor, Bill, Doctor, DoctorListParams, LabRequest, LabTest, Medicine, Page, Patient, PharmacyOrder, Slot, AppNotification } from '@/types';

/** Typed Axios modules, one per microservice, used by TanStack Query hooks in Client Components. */
export const doctorsApi = {
  list: (params: DoctorListParams = {}, signal?: AbortSignal) => unwrap(http.get<Page<Doctor>>('/doctors', { params: { size: 100, ...params }, signal })),
  specializations: (signal?: AbortSignal) => unwrap(http.get<string[]>('/doctors/specializations', { signal })),
  available: (date: string, specialization?: string, signal?: AbortSignal) => unwrap(http.get<AvailableDoctor[]>('/doctors/available', { params: { date, specialization }, signal })),
};
export const appointmentsApi = {
  availability: (doctorId: number, date: string, signal?: AbortSignal) => unwrap(http.get<Slot[]>('/appointments/availability', { params: { doctorId, date }, signal })),
  byPatient: (patientId: number, signal?: AbortSignal) => unwrap(http.get<Appointment[]>(`/appointments/patient/${patientId}`, { signal })),
  byDoctor: (doctorId: number, date?: string, signal?: AbortSignal) => unwrap(http.get<Appointment[]>(`/appointments/doctor/${doctorId}`, { params: { date }, signal })),
  cancel: (id: number, reason?: string) => unwrap(http.put<Appointment>(`/appointments/${id}/cancel`, { reason })),
  book: (b: { patientId: number; doctorId: number; date: string; startTime: string; reason?: string | null }) => unwrap(http.post<Appointment>('/appointments', b)),
};
export const patientsApi = {
  search: (q: string, page = 0, size = 8, signal?: AbortSignal) => unwrap(http.get<Page<Patient>>('/patients', { params: { q, page, size }, signal })),
  get: (id: number, signal?: AbortSignal) => unwrap(http.get<Patient>(`/patients/${id}`, { signal })),
};
export const labApi = {
  tests: (signal?: AbortSignal) => unwrap(http.get<LabTest[]>('/lab/tests', { signal })),
  requests: (p: { status?: string; page?: number; size?: number }, signal?: AbortSignal) => unwrap(http.get<Page<LabRequest>>('/lab/requests', { params: p, signal })),
  byPatient: (patientId: number, signal?: AbortSignal) => unwrap(http.get<LabRequest[]>(`/lab/requests/patient/${patientId}`, { signal })),
  setStatus: (id: number, status: string) => unwrap(http.put<LabRequest>(`/lab/requests/${id}/status`, { status })),
};
export const pharmacyApi = {
  medicines: (signal?: AbortSignal) => unwrap(http.get<Medicine[]>('/pharmacy/medicines', { signal })),
  orders: (p: { status?: string; page?: number; size?: number }, signal?: AbortSignal) => unwrap(http.get<Page<PharmacyOrder>>('/pharmacy/orders', { params: p, signal })),
  restock: (id: number, quantity: number) => unwrap(http.post<Medicine>(`/pharmacy/medicines/${id}/restock`, { quantity })),
};
export const billingApi = {
  byPatient: (patientId: number, signal?: AbortSignal) => unwrap(http.get<Bill[]>(`/bills/patient/${patientId}`, { signal })),
};
export const notificationsApi = {
  my: (page = 0, size = 20, signal?: AbortSignal) => unwrap(http.get<Page<AppNotification>>('/notifications/my', { params: { page, size }, signal })),
};

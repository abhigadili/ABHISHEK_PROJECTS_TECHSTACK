import 'server-only';
import { backendFetch } from '@/lib/api/backend';
import type { Appointment, BookAppointmentRequest, RescheduleRequest, Slot } from '@/types';

const A = { cache: 'no-store' as const, redirectOnUnauthorized: false };
export const appointmentService = {
  byPatient: (patientId: number) => backendFetch<Appointment[]>(`/api/appointments/patient/${patientId}`, { cache: 'no-store' }),
  byDoctor: (doctorId: number, date?: string) => backendFetch<Appointment[]>(`/api/appointments/doctor/${doctorId}`, { query: { date }, cache: 'no-store' }),
  get: (id: number) => backendFetch<Appointment>(`/api/appointments/${id}`, { cache: 'no-store' }),
  availability: (doctorId: number, date: string) => backendFetch<Slot[]>('/api/appointments/availability', { query: { doctorId, date }, cache: 'no-store' }),
  book: (b: BookAppointmentRequest) => backendFetch<Appointment>('/api/appointments', { method: 'POST', body: b, ...A }),
  reschedule: (id: number, b: RescheduleRequest) => backendFetch<Appointment>(`/api/appointments/${id}/reschedule`, { method: 'PUT', body: b, ...A }),
  cancel: (id: number, reason?: string) => backendFetch<Appointment>(`/api/appointments/${id}/cancel`, { method: 'PUT', body: { reason }, ...A }),
  complete: (id: number, notes?: string) => backendFetch<Appointment>(`/api/appointments/${id}/complete`, { method: 'PUT', body: { notes }, ...A }),
};

import { http } from '@/services/api/http';
import type { Appointment, BookAppointmentRequest, ISODate, RescheduleRequest, Slot } from '@/types';

export const appointmentApi = {
  availability: (doctorId: number, date: ISODate, signal?: AbortSignal) => http.get<Slot[]>('/appointments/availability', { doctorId, date }, signal),
  get: (id: number, signal?: AbortSignal) => http.get<Appointment>(`/appointments/${id}`, undefined, signal),
  my: (signal?: AbortSignal) => http.get<Appointment[]>('/appointments/my', undefined, signal),
  forPatient: (patientId: number, signal?: AbortSignal) => http.get<Appointment[]>(`/appointments/patient/${patientId}`, undefined, signal),
  forDoctor: (doctorId: number, date?: ISODate, signal?: AbortSignal) => http.get<Appointment[]>(`/appointments/doctor/${doctorId}`, { date }, signal),
  book: (body: BookAppointmentRequest) => http.post<Appointment>('/appointments', body),
  reschedule: (id: number, body: RescheduleRequest) => http.put<Appointment>(`/appointments/${id}/reschedule`, body),
  cancel: (id: number, reason?: string) => http.put<Appointment>(`/appointments/${id}/cancel`, reason ? { reason } : {}),
  complete: (id: number, notes?: string) => http.put<Appointment>(`/appointments/${id}/complete`, notes ? { notes } : {}),
};

import { http } from '@/services/api/http';
import type { AvailableDoctor, Doctor, DoctorInput, DoctorListParams, ISODate, Page, ScheduleDay, Slot, Unavailability } from '@/types';

export const doctorApi = {
  list: (params: DoctorListParams, signal?: AbortSignal) => http.get<Page<Doctor>>('/doctors', { ...params }, signal),
  get: (id: number, signal?: AbortSignal) => http.get<Doctor>(`/doctors/${id}`, undefined, signal),
  specializations: (signal?: AbortSignal) => http.get<string[]>('/doctors/specializations', undefined, signal),
  available: (date: ISODate, specialization?: string, signal?: AbortSignal) => http.get<AvailableDoctor[]>('/doctors/available', { date, specialization }, signal),
  create: (body: DoctorInput) => http.post<Doctor>('/doctors', body),
  update: (id: number, body: DoctorInput) => http.put<Doctor>(`/doctors/${id}`, body),
  deactivate: (id: number) => http.delete(`/doctors/${id}`),
  slots: (id: number, date: ISODate, signal?: AbortSignal) => http.get<Slot[]>(`/doctors/${id}/slots`, { date }, signal),
  schedule: (id: number, signal?: AbortSignal) => http.get<ScheduleDay[]>(`/doctors/${id}/schedule`, undefined, signal),
  saveSchedule: (id: number, days: ScheduleDay[]) => http.put<ScheduleDay[]>(`/doctors/${id}/schedule`, { days }),
  unavailability: (id: number, signal?: AbortSignal) => http.get<Unavailability[]>(`/doctors/${id}/unavailability`, undefined, signal),
  addUnavailability: (id: number, body: { date: ISODate; reason?: string | null }) => http.post<Unavailability>(`/doctors/${id}/unavailability`, body),
  removeUnavailability: (id: number, unavailabilityId: number) => http.delete(`/doctors/${id}/unavailability/${unavailabilityId}`),
};

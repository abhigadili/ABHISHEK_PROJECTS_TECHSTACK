import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { Appointment, BookAppointmentRequest, ISODate, RescheduleRequest, Slot } from '../models';
import { BaseApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class AppointmentApiService extends BaseApiService {
  protected readonly resource = 'appointments';
  availability(doctorId: number, date: ISODate): Observable<Slot[]> { return this.get<Slot[]>('/availability', { doctorId, date }); }
  getById(id: number): Observable<Appointment> { return this.get<Appointment>(`/${id}`); }
  forPatient(patientId: number): Observable<Appointment[]> { return this.get<Appointment[]>(`/patient/${patientId}`); }
  forDoctor(doctorId: number, date?: ISODate): Observable<Appointment[]> { return this.get<Appointment[]>(`/doctor/${doctorId}`, { date }); }
  book(body: BookAppointmentRequest): Observable<Appointment> { return this.post<Appointment, BookAppointmentRequest>('', body); }
  reschedule(id: number, body: RescheduleRequest): Observable<Appointment> { return this.put<Appointment, RescheduleRequest>(`/${id}/reschedule`, body); }
  cancel(id: number, reason?: string): Observable<Appointment> { return this.put<Appointment>(`/${id}/cancel`, reason ? { reason } : {}); }
  complete(id: number, notes?: string): Observable<Appointment> { return this.put<Appointment>(`/${id}/complete`, notes ? { notes } : {}); }
}

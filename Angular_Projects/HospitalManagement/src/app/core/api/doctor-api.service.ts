import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { AvailableDoctor, Doctor, DoctorInput, DoctorListParams, ISODate, Page, ScheduleDay, Slot, Unavailability } from '../models';
import { CrudApiService } from './base-api.service';

@Injectable({ providedIn: 'root' })
export class DoctorApiService extends CrudApiService<Doctor, DoctorInput, DoctorListParams> {
  protected readonly resource = 'doctors';
  list(params: DoctorListParams = {}): Observable<Page<Doctor>> { return this.get<Page<Doctor>>('', { ...params }); }
  specializations(): Observable<string[]> { return this.get<string[]>('/specializations'); }
  available(date: ISODate, specialization?: string): Observable<AvailableDoctor[]> { return this.get<AvailableDoctor[]>('/available', { date, specialization }); }
  slots(id: number, date: ISODate): Observable<Slot[]> { return this.get<Slot[]>(`/${id}/slots`, { date }); }
  schedule(id: number): Observable<ScheduleDay[]> { return this.get<ScheduleDay[]>(`/${id}/schedule`); }
  saveSchedule(id: number, days: ScheduleDay[]): Observable<ScheduleDay[]> { return this.put<ScheduleDay[], { days: ScheduleDay[] }>(`/${id}/schedule`, { days }); }
  unavailability(id: number): Observable<Unavailability[]> { return this.get<Unavailability[]>(`/${id}/unavailability`); }
  addUnavailability(id: number, body: { date: ISODate; reason?: string | null }): Observable<Unavailability> { return this.post<Unavailability>(`/${id}/unavailability`, body); }
  removeUnavailability(id: number, uid: number): Observable<void> { return this.remove(`/${id}/unavailability/${uid}`); }
}

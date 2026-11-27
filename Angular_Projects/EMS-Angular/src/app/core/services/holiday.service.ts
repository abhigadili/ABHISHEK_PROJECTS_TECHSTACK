import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Holiday, HolidayWriteRequest, WeeklyOff } from '../models/leave.models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class HolidayService {
  private readonly api = inject(ApiService);

  list(from?: string | null, to?: string | null): Observable<Holiday[]> {
    return this.api.get<Holiday[]>('/holidays', { from, to });
  }

  create(body: HolidayWriteRequest): Observable<Holiday> {
    return this.api.post<Holiday>('/holidays', body, { skipErrorToast: true });
  }

  update(id: number, body: HolidayWriteRequest): Observable<Holiday> {
    return this.api.put<Holiday>(`/holidays/${id}`, body, { skipErrorToast: true });
  }

  remove(id: number): Observable<null> {
    return this.api.delete(`/holidays/${id}`);
  }

  weeklyOffs(): Observable<WeeklyOff[]> {
    return this.api.get<WeeklyOff[]>('/weekly-offs');
  }

  setWeeklyOffs(days: number[], location?: string): Observable<WeeklyOff[]> {
    return this.api.put<WeeklyOff[]>('/weekly-offs', { days, location });
  }
}

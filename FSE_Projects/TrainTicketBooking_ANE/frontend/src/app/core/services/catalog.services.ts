import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiClient } from './api-client.service';
import type { CoachSeat, CoachType, DateOverride, Paged, PageQuery, RoutePayload, SeatMap, SearchParams, SearchResult, SeatType, Station, StationDetail, Train, TrainAvailability, TrainCoach, TrainPayload, TrainRoute, TrainSchedule, TrainStatus } from '../models/models';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiClient);
  readonly coachTypes$: Observable<CoachType[]> = this.api.get<CoachType[]>('/lookups/coach-types', { public: true }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
  readonly seatTypes$: Observable<SeatType[]> = this.api.get<SeatType[]>('/lookups/seat-types', { public: true }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
}

@Injectable({ providedIn: 'root' })
export class StationService {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.getPaged<Station>('/stations', { params: q, public: true, noLoading: true }); }
  /** Autocomplete feed (active stations only). */
  suggest(term: string) { return this.api.getPaged<Station>('/stations', { params: { q: term, size: 8, active: 'true' }, public: true, noLoading: true }); }
  get(id: number) { return this.api.get<StationDetail>(`/stations/${id}`, { public: true }); }
  create(b: Partial<Station>) { return this.api.post<Station>('/stations', b, { silent: true }); }
  update(id: number, b: Partial<Station>) { return this.api.put<Station>(`/stations/${id}`, b, { silent: true }); }
  remove(id: number) { return this.api.delete(`/stations/${id}`, { silent: true }); }
  /** Used by the async validator of the station form: is this code already taken by another station? */
  codeTaken(code: string, exceptId?: number): Observable<boolean> {
    return this.api.getPaged<Station>('/stations', { params: { q: code, size: 20 }, public: true, noLoading: true }).pipe(map((p) => p.items.some((s) => s.code === code && s.id !== exceptId)));
  }
}

@Injectable({ providedIn: 'root' })
export class TrainService {
  private readonly api = inject(ApiClient);
  search(p: SearchParams): Observable<SearchResult[]> { return this.api.get<SearchResult[]>('/trains/search', { params: p, public: true }); }
  list(q: PageQuery = {}) { return this.api.getPaged<Train>('/trains', { params: q, public: true }); }
  get(id: number) { return this.api.get<Train>(`/trains/${id}`, { public: true }); }
  availability(id: number, date: string, from?: number, to?: number) { return this.api.get<TrainAvailability>(`/trains/${id}/availability`, { params: { date, from, to }, public: true }); }
  coaches(id: number) { return this.api.get<TrainCoach[]>(`/trains/${id}/coaches`, { public: true }); }
  create(b: TrainPayload) { return this.api.post<Train>('/trains', b, { silent: true }); }
  update(id: number, b: { name: string; type: string; status: string; route?: RoutePayload }) { return this.api.put<Train>(`/trains/${id}`, b, { silent: true }); }
  setStatus(id: number, status: TrainStatus, reason?: string) { return this.api.patch<Train>(`/trains/${id}/status`, { status, reason }, { silent: true }); }
  remove(id: number) { return this.api.delete(`/trains/${id}`, { silent: true }); }
  addCoach(id: number, b: { coachTypeId: number; number: string }) { return this.api.post<TrainCoach>(`/trains/${id}/coaches`, b, { silent: true }); }
  setOverride(id: number, b: { date: string; cancelled: boolean; reason?: string }) { return this.api.post<DateOverride>(`/trains/${id}/date-overrides`, b, { silent: true }); }
  removeOverride(id: number, overrideId: number) { return this.api.delete(`/trains/${id}/date-overrides/${overrideId}`); }
  routes(q: PageQuery = {}) { return this.api.getPaged<TrainRoute>('/routes', { params: q, public: true }); }
  route(id: number) { return this.api.get<TrainRoute>(`/routes/${id}`, { public: true }); }
  createRoute(trainId: number, b: RoutePayload) { return this.api.post<TrainRoute>('/routes', { ...b, trainId }, { silent: true }); }
  updateRoute(id: number, b: RoutePayload) { return this.api.put<TrainRoute>(`/routes/${id}`, b, { silent: true }); }
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly api = inject(ApiClient);
  list(q: PageQuery = {}) { return this.api.getPaged<TrainSchedule>('/schedules', { params: q, public: true }); }
  get(id: number) { return this.api.get<TrainSchedule>(`/schedules/${id}`, { public: true }); }
  create(b: unknown) { return this.api.post<TrainSchedule>('/schedules', b, { silent: true }); }
  update(id: number, b: unknown) { return this.api.put<TrainSchedule>(`/schedules/${id}`, b, { silent: true }); }
  remove(id: number) { return this.api.delete(`/schedules/${id}`, { silent: true }); }
}

@Injectable({ providedIn: 'root' })
export class SeatService {
  private readonly api = inject(ApiClient);
  /** Segment-aware seat map: status is computed by the backend for exactly the requested from -> to journey. */
  seatMap(p: { trainId: number; date: string; from: number; to: number; coachTypeId: number }) { return this.api.get<SeatMap>('/seats/availability', { params: p, public: true }); }
  coachSeats(coachId: number) { return this.api.get<{ coach: TrainCoach; seats: CoachSeat[] }>(`/coaches/${coachId}/seats`, { public: true }); }
  setStatus(seatId: number, status: 'ACTIVE' | 'BLOCKED') { return this.api.patch<CoachSeat>(`/seats/${seatId}`, { status }, { silent: true }); }
  removeCoach(coachId: number) { return this.api.delete(`/coaches/${coachId}`, { silent: true }); }
}
export type { Paged };

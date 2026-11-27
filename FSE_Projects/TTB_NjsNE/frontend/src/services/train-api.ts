import type { Paged, SearchResult, TrainLite, SeatMap, CoachType } from '@/types';
import { del, get, patch, post, put } from './api-client';
export interface CoachRow { id: number; number: string; coachType: { code: string; name: string } }
export const trainApi = {
  list: async (params: { page?: number; size?: number; q?: string }): Promise<Paged<TrainLite>> => { const r = await get<TrainLite[]>('/trains', params); return { data: r.data, meta: r.meta! }; },
  one: async <T = TrainLite>(id: number) => (await get<T>(`/trains/${id}`)).data,
  search: async (p: Record<string, string>, signal?: AbortSignal) => (await get<SearchResult[]>('/trains/search', p, signal)).data,
  create: (b: unknown) => post('/trains', b), update: (id: number, b: unknown) => put(`/trains/${id}`, b), remove: (id: number) => del(`/trains/${id}`),
  setStatus: (id: number, b: { status: string; reason?: string }) => patch(`/trains/${id}/status`, b),
  cancelRun: (id: number, b: { date: string; cancelled: boolean; reason?: string }) => post(`/trains/${id}/date-overrides`, b),
  coaches: async (id: number) => (await get<CoachRow[]>(`/trains/${id}/coaches`)).data,
  addCoach: (id: number, b: { coachTypeId: number; number: string }) => post(`/trains/${id}/coaches`, b), removeCoach: (id: number) => del(`/coaches/${id}`),
  coachTypes: async () => (await get<CoachType[]>('/lookups/coach-types')).data,
};
export const seatApi = {
  map: async (p: { trainId: number; from: number; to: number; date: string; coachTypeId: number }, signal?: AbortSignal) => (await get<SeatMap>('/seats/availability', p, signal)).data,
  setStatus: (id: number, status: 'ACTIVE' | 'BLOCKED') => patch(`/seats/${id}`, { status }),
};

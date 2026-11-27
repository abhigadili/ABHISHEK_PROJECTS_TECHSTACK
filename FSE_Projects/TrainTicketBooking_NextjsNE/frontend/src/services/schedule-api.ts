import type { Paged } from '@/types';
import { del, get, post, put } from './api-client';
export interface Schedule { id: number; trainId: number; validFrom: string; validTo: string | null; active: boolean; notes?: string | null; operatingDays: { dayOfWeek: number }[]; train: { id: number; number: string; name: string } }
export const scheduleApi = {
  list: async (params: { page?: number; size?: number; trainId?: number }): Promise<Paged<Schedule>> => { const r = await get<Schedule[]>('/schedules', params); return { data: r.data, meta: r.meta! }; },
  create: (b: unknown) => post('/schedules', b), update: (id: number, b: unknown) => put(`/schedules/${id}`, b), remove: (id: number) => del(`/schedules/${id}`),
};
export const routeApi = {
  one: async (id: number) => (await get<unknown>(`/routes/${id}`)).data, update: (id: number, b: unknown) => put(`/routes/${id}`, b),
};

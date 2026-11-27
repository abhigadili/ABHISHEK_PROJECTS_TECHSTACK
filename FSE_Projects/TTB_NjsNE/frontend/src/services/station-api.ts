import type { Paged, Station } from '@/types';
import { del, get, post, put } from './api-client';
import type { StationInput } from '@/validations/catalog';
export const stationApi = {
  list: async (params: { page?: number; size?: number; q?: string; active?: string }): Promise<Paged<Station>> => { const r = await get<Station[]>('/stations', params); return { data: r.data, meta: r.meta! }; },
  create: (b: StationInput) => post<Station>('/stations', b), update: (id: number, b: StationInput) => put<Station>(`/stations/${id}`, b), remove: (id: number) => del(`/stations/${id}`),
};

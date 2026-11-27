import 'server-only';
import { backend } from '@/lib/server/backend';
import { REVALIDATE, TAGS } from '@/lib/constants';
import type { Station } from '@/types';

/** Public reference data: Data Cache with time-based revalidation (1 h) + tag for on-demand revalidation after admin edits. */
export async function getStations(q?: string): Promise<Station[]> {
  const { data } = await backend<Station[]>('/stations', { auth: false, params: { size: 100, active: 'true', q }, revalidate: REVALIDATE.stations, tags: [TAGS.stations] });
  return data;
}
export async function getStation(id: number | string): Promise<Station> {
  return (await backend<Station>(`/stations/${id}`, { auth: false, revalidate: REVALIDATE.stations, tags: [TAGS.stations] })).data;
}

import 'server-only';
import { backend } from '@/lib/server/backend';
import { REVALIDATE, TAGS } from '@/lib/constants';
import type { SearchResult, Station, TrainLite } from '@/types';

export interface RouteStop { id: number; seq: number; arrivalTime: string | null; departureTime: string | null; dayOffset: number; distanceKm: number; station: Station }
export interface TrainDetail extends TrainLite { route?: { id: number; name: string; stops: RouteStop[] } }
export interface ScheduleRow { id: number; trainId: number; validFrom: string; validTo: string | null; active: boolean; notes?: string | null; operatingDays: { dayOfWeek: number }[] }

/** ISR: train catalogue revalidates every 5 minutes or immediately when an admin edits a train (revalidateTag). */
export const getTrains = (params: { page?: number; size?: number; q?: string } = {}) =>
  backend<TrainLite[]>('/trains', { auth: false, params: { size: 12, ...params }, revalidate: REVALIDATE.trains, tags: [TAGS.trains] });
export async function getTrain(id: number | string): Promise<TrainDetail> {
  return (await backend<TrainDetail>(`/trains/${id}`, { auth: false, revalidate: REVALIDATE.train, tags: [TAGS.trains, TAGS.train(id)] })).data;
}
export async function getTrainSchedules(trainId: number | string): Promise<ScheduleRow[]> {
  return (await backend<ScheduleRow[]>('/schedules', { auth: false, params: { trainId, size: 20 }, revalidate: REVALIDATE.train, tags: [TAGS.train(trainId)] })).data;
}
/** Search must always show live availability and fares: no cache. */
export async function searchTrains(p: { from: string; to: string; date: string; sort?: string; type?: string }): Promise<SearchResult[]> {
  return (await backend<SearchResult[]>('/trains/search', { auth: false, params: p })).data;
}

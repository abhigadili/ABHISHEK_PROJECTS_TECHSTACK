import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { getStations } from '@/features/stations/server';
import { addDaysIso } from '@/utils/format';

/**
 * CATCH-ALL route: /timetable/SC            -> permanent redirect to the station page
 *                  /timetable/SC/NDLS       -> redirect to tomorrow's search between the two stations
 *                  /timetable/a/b/c/...     -> 404
 * Station codes are resolved against the cached station list (no extra backend call).
 */
export default async function TimetableRedirect({ params }: { params: Promise<{ stations: string[] }> }) {
  const { stations: seg } = await params; const all = await getStations().catch(() => []);
  const find = (code: string) => all.find((s) => s.code.toLowerCase() === decodeURIComponent(code).toLowerCase());
  if (seg.length === 1) { const s = find(seg[0]); if (!s) notFound(); permanentRedirect(`/stations/${s.id}`); }
  if (seg.length === 2) { const a = find(seg[0]), b = find(seg[1]); if (!a || !b || a.id === b.id) notFound(); redirect(`/search?from=${a.id}&to=${b.id}&date=${addDaysIso(1)}`); }
  notFound();
}

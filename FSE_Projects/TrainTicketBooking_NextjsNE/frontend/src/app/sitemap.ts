import type { MetadataRoute } from 'next';
import { getStations } from '@/features/stations/server';
import { getTrains } from '@/features/trains/server';
import { HELP } from '@/features/help/content';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
/** Generated sitemap: static pages + every station + every train (read from the cached public catalogue). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [stations, trains] = await Promise.all([getStations().catch(() => []), getTrains({ size: 100 }).then((r) => r.data).catch(() => [])]);
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'daily', priority: 1 }, { url: `${base}/trains`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 }, { url: `${base}/stations`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/help`, changeFrequency: 'monthly', priority: 0.4 }, ...HELP.map((s) => ({ url: `${base}/help/${s.slug}`, changeFrequency: 'monthly' as const, priority: 0.3 })),
    ...trains.map((t) => ({ url: `${base}/trains/${t.id}`, lastModified: now, changeFrequency: 'daily' as const, priority: 0.6 })),
    ...stations.map((s) => ({ url: `${base}/stations/${s.id}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.5 })),
  ];
}

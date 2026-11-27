import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/config/public';
import { getPublicDoctors, getPublicHospitals } from '@/lib/api/catalog';

export const revalidate = 3600;
/** Sitemap of the public catalogue (hospitals + doctors); falls back to the static pages if the backend is unreachable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ['', '/public/hospitals', '/public/doctors', '/public/info', '/login'].map((p) => ({ url: `${APP_URL}${p}`, changeFrequency: 'weekly' as const }));
  try {
    const [h, d] = await Promise.all([getPublicHospitals(), getPublicDoctors()]);
    return [...base, ...h.map((x) => ({ url: `${APP_URL}/public/hospitals/${x.id}` })), ...d.map((x) => ({ url: `${APP_URL}/public/doctors/${x.id}` }))];
  } catch { return base; }
}

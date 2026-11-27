import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/configuration/public';
import { getPublicDoctors, getPublicHospitals } from '@/server/cache';
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = ['', '/hospitals', '/doctors', '/departments', '/about', '/contact', '/help'].map((p) => ({ url: `${APP_URL}${p}`, changeFrequency: 'weekly' as const }));
  try { const [h, d] = await Promise.all([getPublicHospitals(), getPublicDoctors()]); return [...base, ...h.map((x) => ({ url: `${APP_URL}/hospitals/${x.slug}` })), ...d.map((x) => ({ url: `${APP_URL}/doctors/${x.id}` }))]; } catch { return base; }
}

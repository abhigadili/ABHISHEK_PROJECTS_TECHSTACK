import type { MetadataRoute } from 'next';
import { DOCS, HELP } from '@/content/articles';
const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
/** Only PUBLIC pages are listed. Built from the same content arrays that generate the pages, so it can never drift. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date('2026-01-01');
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/help`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...HELP.map((a) => ({ url: `${base}/help/${a.slug.join('/')}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...DOCS.map((a) => ({ url: `${base}/docs/${a.slug.join('/')}`, lastModified: now, changeFrequency: 'yearly' as const, priority: 0.5 })),
  ];
}

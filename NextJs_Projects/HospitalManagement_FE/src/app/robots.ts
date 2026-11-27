import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/configuration/public';
/** robots.txt: only the public directory is crawlable. */
export default function robots(): MetadataRoute.Robots { return { rules: [{ userAgent: '*', allow: ['/', '/hospitals', '/doctors'], disallow: ['/patient', '/doctor/', '/admin', '/lab', '/pharmacy', '/billing', '/superadmin', '/account', '/api/'] }], sitemap: `${APP_URL}/sitemap.xml` }; }

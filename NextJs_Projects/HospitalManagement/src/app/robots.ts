import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/config/public';
/** Robots metadata: only the public pages are crawlable; the authenticated app and the BFF are not. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: ['/', '/public/'], disallow: ['/dashboard', '/patients', '/appointments', '/api/', '/billing', '/laboratory', '/pharmacy', '/medical-records', '/prescriptions', '/notifications', '/admin'] }], sitemap: `${APP_URL}/sitemap.xml` };
}

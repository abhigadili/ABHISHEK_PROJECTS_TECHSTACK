import type { MetadataRoute } from 'next';
const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
/** Authenticated areas and the API are disallowed; the page-level `robots: noindex` metadata is the second line of defence. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: ['/', '/help', '/docs'], disallow: ['/api/', '/dashboard', '/employees', '/departments', '/designations', '/organization', '/attendance', '/leaves', '/holidays', '/reports', '/users', '/notifications', '/profile', '/login', '/register', '/forgot-password', '/reset-password', '/learn'] }], sitemap: `${base}/sitemap.xml`, host: base };
}

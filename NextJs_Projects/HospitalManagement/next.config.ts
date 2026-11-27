import type { NextConfig } from 'next';

/**
 * Next.js configuration (Fundamentals: next.config.ts).
 * - `cacheComponents` is deliberately OFF: it forbids route-segment config (`revalidate`, `dynamic`, `dynamicParams`) and
 *   fetch-level `revalidate`, which this project demonstrates on purpose (ISR, SSG, fetch cache options). See NEXTJS_ARCHITECTURE.md.
 * - Private env (NODE_API_BASE_URL, PUBLIC_CATALOG_*) is read only by server-only modules; only NEXT_PUBLIC_* reaches the browser.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75, 90],
    // Remote Images + Remote Patterns: generated initials avatars for doctor profile pictures
    remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com', pathname: '/api/**' }],
  },
  experimental: {
    serverActions: { bodySizeLimit: '6mb' }, // lab-report attachments are <= 5 MB
    optimizePackageImports: ['@mui/material', '@mui/x-date-pickers', 'lucide-react'], // Package Optimization / tree shaking
    staleTimes: { dynamic: 30, static: 180 }, // Client-side Router Cache lifetimes
  },
  // Cache-Control headers + CDN caching for the public (non-personal) pages only
  async headers() {
    return [
      { source: '/public/:path*', headers: [{ key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=3600' }] },
      { source: '/(dashboard)/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] },
    ];
  },
  turbopack: {
    rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } },
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

/**
 * Next.js 16 with Cache Components (+ Partial Prefetching): data fetching is dynamic by default, and we opt IN to caching with
 * `'use cache'` / `cacheLife` / `cacheTag`. Partial Prerendering (static shell + streamed dynamic holes) is the default rendering
 * model of this mode — see docs/nextjs-concepts/23-partial-prerendering.md.
 */
const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Server Actions accept request bodies up to 1 MB by default; profile pictures (2 MB) and leave documents (5 MB) are uploaded through
  // actions, so the limit is raised just above the largest allowed file (each action still enforces its own per-type limit).
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  poweredByHeader: false, // don't advertise the framework
  reactStrictMode: true, // dev-only double render/effect to surface impure code (default in App Router; stated explicitly)
  images: {
    // Only OUR OWN public images are optimised. Employee pictures are private and are served by an authenticated route handler,
    // so there is deliberately NO remotePatterns entry that would let the public optimizer fetch them.
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;

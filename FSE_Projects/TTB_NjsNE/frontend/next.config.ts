import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // The monorepo root holds the hoisted node_modules (npm workspaces).
  outputFileTracingRoot: path.join(__dirname, '..'),
  turbopack: { root: path.join(__dirname, '..') },
  poweredByHeader: false,
  reactStrictMode: true,
  // Next 16: enables forbidden() / unauthorized() and forbidden.tsx / unauthorized.tsx
  experimental: { authInterrupts: true },
  // Remote image allow-list (used for avatars on the profile page)
  images: { formats: ['image/avif', 'image/webp'], remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com', pathname: '/api/**' }] },
  // Tree-shake icon / UI packages that export hundreds of modules
  // Static redirects (permanent) and rewrites live here; per-request logic lives in src/proxy.ts
  async redirects() {
    return [
      { source: '/home', destination: '/', permanent: true },
      { source: '/my-bookings', destination: '/account/bookings', permanent: true },
    ];
  },
  async rewrites() {
    return [{ source: '/pnr-status', destination: '/account/pnr' }];
  },
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] }];
  },
};
export default nextConfig;

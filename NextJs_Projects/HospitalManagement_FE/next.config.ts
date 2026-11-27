import type { NextConfig } from 'next';

/**
 * next.config.ts
 * - `cacheComponents` is OFF on purpose: it forbids route-segment config (`revalidate`, `dynamic`, `dynamicParams`) that this project
 *   demonstrates for ISR/static/dynamic rendering. Caching uses the classic Data Cache + Full Route Cache + `unstable_cache` + tags.
 * - Secrets are only read in `server-only` modules; only NEXT_PUBLIC_* values reach the browser.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'otplib', 'qrcode', 'nodemailer'],
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75, 90],
    remotePatterns: [{ protocol: 'https', hostname: 'ui-avatars.com', pathname: '/api/**' }], // doctor portraits
  },
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
    optimizePackageImports: ['@mui/material', '@mui/icons-material', 'lucide-react'],
    staleTimes: { dynamic: 30, static: 180 }, // Router Cache lifetimes
  },
  async headers() {
    return [
      { source: '/(patient|doctor|admin|lab|pharmacy|billing|superadmin|account)/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store' }] },
      { source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] },
    ];
  },
  turbopack: { rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } } },
};
export default nextConfig;

import 'server-only';

/** Server-only configuration layer. Nothing in here is ever bundled for the browser (`server-only`). */
const required = (name: string, fallback?: string) => {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing environment variable ${name}`);
  return v;
};

export const serverEnv = {
  backendUrl: required('NODE_API_BASE_URL', 'http://localhost:30080').replace(/\/$/, ''),
  revalidateSecret: process.env.REVALIDATE_SECRET ?? '',
  catalogUsername: process.env.PUBLIC_CATALOG_USERNAME ?? '',
  catalogPassword: process.env.PUBLIC_CATALOG_PASSWORD ?? '',
  isProd: process.env.NODE_ENV === 'production',
} as const;

export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3200',
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'CityCare HMS',
} as const;

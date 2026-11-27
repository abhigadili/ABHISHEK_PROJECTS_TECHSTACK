import 'server-only';
import { unstable_cache } from 'next/cache';
import { serverEnv } from '@/lib/config/env';
import { backendFetch, backendResponse } from './backend';
import type { Department, Doctor, Hospital, Page, TokenResponse } from '@/types';
import { ApiError } from '@/lib/utilities/api-error';
import { CACHE_TAGS } from '@/constants/cache';

/**
 * Public catalogue access (hospital info, doctor directory) for statically generated / ISR pages.
 * The gateway requires a JWT on every /api/* route, so a dedicated READ-ONLY PATIENT login (from env) is used server-side.
 * The token lives in module memory only and is never sent to the browser.
 */
let cached: { token: string; exp: number } | null = null;

async function catalogToken(force = false): Promise<string> {
  if (!force && cached && cached.exp > Date.now() + 30_000) return cached.token;
  if (!serverEnv.catalogUsername || !serverEnv.catalogPassword) throw new ApiError(503, 'Public catalogue login is not configured (PUBLIC_CATALOG_USERNAME / PUBLIC_CATALOG_PASSWORD)');
  const t = await backendFetch<TokenResponse>('/api/auth/login', { method: 'POST', auth: 'none', body: { username: serverEnv.catalogUsername, password: serverEnv.catalogPassword }, cache: 'no-store' });
  cached = { token: t.accessToken, exp: Date.now() + t.expiresInSeconds * 1000 };
  return t.accessToken;
}

async function catalogGet<T>(path: string, query?: Record<string, string | number | boolean>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await catalogToken(attempt > 0);
    const res = await backendResponse(path, { auth: { token }, query, cache: 'no-store' });
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 401 || attempt > 0) throw ApiError.fromBody(res.status, await res.json().catch(() => null));
  }
  throw new ApiError(401, 'Unauthorized');
}

/* unstable_cache: cache key does NOT include the (rotating) token, tags drive on-demand revalidation, `revalidate` = ISR window. */
export const getPublicHospitals = unstable_cache(async () => catalogGet<Hospital[]>('/api/hospitals'), ['public-hospitals'], { revalidate: 3600, tags: [CACHE_TAGS.hospitals] });

export const getPublicHospital = unstable_cache(
  async (id: number) => {
    try { return await catalogGet<Hospital>(`/api/hospitals/${id}`); } catch (e) { if (e instanceof ApiError && e.isNotFound) return null; throw e; }
  },
  ['public-hospital'],
  { revalidate: 3600, tags: [CACHE_TAGS.hospitals] },
);

export const getPublicDepartments = unstable_cache(async (hospitalId: number) => catalogGet<Department[]>(`/api/hospitals/${hospitalId}/departments`), ['public-departments'], { revalidate: 3600, tags: [CACHE_TAGS.departments] });

export const getPublicDoctors = unstable_cache(
  async (specialization?: string) => (await catalogGet<Page<Doctor>>('/api/doctors', { active: true, size: 100, ...(specialization ? { specialization } : {}) })).content,
  ['public-doctors'],
  { revalidate: 300, tags: [CACHE_TAGS.doctors] },
);

export const getPublicDoctor = unstable_cache(
  async (id: number) => {
    try { return await catalogGet<Doctor>(`/api/doctors/${id}`); } catch (e) { if (e instanceof ApiError && e.isNotFound) return null; throw e; }
  },
  ['public-doctor'],
  { revalidate: 300, tags: [CACHE_TAGS.doctors] },
);

export const getPublicSpecializations = unstable_cache(async () => catalogGet<string[]>('/api/doctors/specializations'), ['public-specializations'], { revalidate: 3600, tags: [CACHE_TAGS.doctors] });

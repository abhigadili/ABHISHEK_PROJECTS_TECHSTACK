import 'server-only';
import { redirect } from 'next/navigation';
import { serverEnv } from '@/lib/config/env';
import { getAccessToken } from '@/lib/auth/session';
import { ApiError } from '@/lib/utilities/api-error';
import type { ApiErrorBody } from '@/types';

export type Auth = 'session' | 'none' | { token: string };
export type Query = Record<string, string | number | boolean | undefined | null>;

export interface BackendOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown | FormData;
  query?: Query;
  auth?: Auth;
  /** Fetch cache mode: 'no-store' (always dynamic), 'force-cache' (cache until revalidated), or leave undefined. */
  cache?: RequestCache;
  /** Time-based revalidation (seconds) -> ISR style data cache entry. */
  revalidate?: number | false;
  /** Cache tags for on-demand revalidation (revalidateTag / updateTag). */
  tags?: string[];
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Page contexts redirect to /login on 401; Server Actions & Route Handlers set false and handle the ApiError themselves. */
  redirectOnUnauthorized?: boolean;
  timeoutMs?: number;
}

export function buildUrl(path: string, query?: Query) {
  const u = new URL(`${serverEnv.backendUrl}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}

/** Raw server-to-server call to the existing Node.js gateway. Returns the Response (used for file downloads and streaming). */
export async function backendResponse(path: string, o: BackendOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...o.headers };
  const auth = o.auth ?? 'session';
  const token = auth === 'session' ? await getAccessToken() : auth === 'none' ? null : auth.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (o.body instanceof FormData) body = o.body;
  else if (o.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(o.body);
  }
  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = { method: o.method ?? 'GET', headers, body, signal: o.signal ?? AbortSignal.timeout(o.timeoutMs ?? 15000) };
  if (o.cache) init.cache = o.cache;
  if (o.revalidate !== undefined || o.tags) init.next = { ...(o.revalidate !== undefined ? { revalidate: o.revalidate } : {}), ...(o.tags ? { tags: o.tags } : {}) };
  try {
    return await fetch(buildUrl(path, o.query), init);
  } catch (e) {
    throw new ApiError(0, e instanceof Error && e.name === 'TimeoutError' ? 'The hospital backend timed out' : 'The hospital backend is unreachable', [], true);
  }
}

/** Typed JSON call with centralised error handling. */
export async function backendFetch<T = unknown>(path: string, o: BackendOptions = {}): Promise<T> {
  const res = await backendResponse(path, o);
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
  const body = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null;
  if (res.status === 401 && (o.auth ?? 'session') === 'session' && o.redirectOnUnauthorized !== false) redirect('/login?reason=expired');
  throw ApiError.fromBody(res.status, body);
}

import 'server-only';
import { cookies } from 'next/headers';
import type { ZodType } from 'zod';
import { env } from './env';
import { ACCESS_COOKIE } from './cookies';
import { pageMetaSchema, type PageMeta } from '@/schemas/api';

/** Error type thrown by every server-side API call. `message` is SAFE to show to users; internals stay in the server log. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: { field: string; message: string }[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

export interface CacheOptions {
  /** seconds; `false` = cache until invalidated */
  revalidate?: number | false;
  tags?: string[];
}
export interface ApiOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** default true: Bearer token read from the HttpOnly cookie. Pass `false` for public endpoints. */
  auth?: boolean;
  /** explicit token (needed when cookies() is unavailable, e.g. inside the proxy) */
  token?: string;
  schema?: ZodType<T>;
  /** Opt IN to the Data Cache. Omit for per-request, never-cached data (everything user-specific). */
  cache?: CacheOptions;
  timeoutMs?: number;
}

function url(path: string, query?: ApiOptions<unknown>['query']): string {
  const u = new URL(env.EMS_API_URL.replace(/\/$/, '') + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}

async function authHeader(opts: { auth?: boolean; token?: string }): Promise<Record<string, string>> {
  if (opts.auth === false) return {};
  const token = opts.token ?? (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'You are not signed in');
  return { Authorization: `Bearer ${token}` };
}

async function send(path: string, opts: ApiOptions<unknown>): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(await authHeader(opts)) };
  let body: BodyInit | undefined;
  if (opts.body instanceof FormData) body = opts.body; // fetch sets the multipart boundary itself
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
  try {
    return await fetch(url(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? env.EMS_API_TIMEOUT_MS), // cancellation + timeout
      ...(opts.cache ? { next: { revalidate: opts.cache.revalidate, tags: opts.cache.tags } } : { cache: 'no-store' as const }),
    });
  } catch (e) {
    const timeout = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    console.error('[api] request failed', { path, timeout, error: e instanceof Error ? e.message : String(e) });
    throw new ApiError(503, timeout ? 'API_TIMEOUT' : 'API_UNREACHABLE', 'The service is temporarily unavailable. Please try again.');
  }
}

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: { field: string; message: string }[]; requestId?: string } } | null;
  const e = body?.error;
  // 5xx internals are logged, never forwarded
  if (res.status >= 500) console.error('[api] upstream error', { status: res.status, code: e?.code, requestId: e?.requestId });
  throw new ApiError(res.status, e?.code ?? `HTTP_${res.status}`, res.status >= 500 ? 'The service had a problem. Please try again.' : (e?.message ?? 'Request failed'), e?.details ?? [], e?.requestId);
}

/** JSON call with envelope handling and runtime validation of the response. */
export async function apiFetch<T>(path: string, opts: ApiOptions<T> = {}): Promise<{ data: T; meta?: PageMeta }> {
  const res = await send(path, opts);
  if (!res.ok) return fail(res);
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown; meta?: unknown } | null;
  if (!json || json.success !== true) throw new ApiError(502, 'INVALID_RESPONSE', 'Unexpected response from the service');
  let data = json.data as T;
  if (opts.schema) {
    const parsed = opts.schema.safeParse(json.data);
    if (!parsed.success) {
      console.error('[api] response failed validation', { path, issues: parsed.error.issues.slice(0, 5) });
      throw new ApiError(502, 'INVALID_RESPONSE', 'Unexpected response from the service');
    }
    data = parsed.data;
  }
  const meta = pageMetaSchema.safeParse(json.meta);
  return { data, meta: meta.success ? meta.data : undefined };
}

/** Binary endpoints (profile pictures, CSV, leave documents). Returns the upstream Response untouched on success. */
export async function apiFetchRaw(path: string, opts: ApiOptions<never> = {}): Promise<Response> {
  const res = await send(path, opts);
  if (!res.ok) return fail(res);
  return res;
}

export async function apiPaged<T>(path: string, opts: ApiOptions<T[]>): Promise<{ items: T[]; meta: PageMeta }> {
  const { data, meta } = await apiFetch<T[]>(path, opts);
  return { items: data, meta: meta ?? { page: 1, limit: data.length, total: data.length, totalPages: 1 } };
}

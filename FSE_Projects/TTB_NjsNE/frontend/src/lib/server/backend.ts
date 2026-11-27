import 'server-only';
import type { Envelope, PageMeta } from '@/types';
import { getAccessToken } from './session';
import { API_ORIGIN } from './refresh';

export class BackendError extends Error {
  constructor(message: string, public status: number, public code = 'ERROR', public fields?: Record<string, string>) { super(message); }
}
export interface BackendOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; params?: Record<string, string | number | boolean | undefined | null>;
  /** false = public endpoint (cacheable). Default true = sends the user's bearer token and is NEVER cached. */
  auth?: boolean; revalidate?: number | false; tags?: string[]; signal?: AbortSignal;
}
const qs = (p?: BackendOptions['params']) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(p ?? {})) if (v !== undefined && v !== null && v !== '') u.set(k, String(v)); const s = u.toString(); return s ? `?${s}` : ''; };

/**
 * Native-fetch client for Server Components / Actions. Caching rule enforced here:
 *  - authenticated calls (default) => `cache: 'no-store'` so private data can never land in the shared Data Cache;
 *  - public calls (`auth:false`) may opt into time-based revalidation and cache tags.
 */
export async function backend<T>(path: string, o: BackendOptions = {}): Promise<{ data: T; meta?: PageMeta }> {
  const auth = o.auth ?? true; const headers: Record<string, string> = { accept: 'application/json' };
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (auth) { const at = await getAccessToken(); if (!at) throw new BackendError('Not signed in', 401, 'UNAUTHORIZED'); headers.authorization = `Bearer ${at}`; }
  const init: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = { method: o.method ?? 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined, signal: o.signal };
  if (auth || (o.revalidate === undefined && !o.tags)) init.cache = 'no-store'; else init.next = { revalidate: o.revalidate, tags: o.tags };
  let res: Response;
  try { res = await fetch(`${API_ORIGIN}/api${path}${qs(o.params)}`, init); } catch { throw new BackendError('The booking service is unreachable.', 503, 'NETWORK'); }
  const json = (await res.json().catch(() => null)) as (Envelope<T> & { error?: { code: string; message: string; fields?: Record<string, string> } }) | null;
  if (!res.ok || !json?.success) throw new BackendError(json?.error?.message ?? `Request failed (${res.status})`, res.status, json?.error?.code, json?.error?.fields);
  return { data: json.data, meta: json.meta };
}

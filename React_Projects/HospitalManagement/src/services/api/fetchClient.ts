import { API_PREFIX, config } from '@/constants/config';
import { ApiError } from '@/services/axios/errors';
import type { ApiErrorBody } from '@/types';
import { tokenStore } from '@/services/axios/tokenStore';
import { refreshSession } from '@/services/axios/refresh';

/**
 * Thin wrapper over the browser Fetch API, used by the Medical Records module (see REACT_CONCEPTS_IMPLEMENTATION.md).
 * It follows the same auth contract as the Axios client: bearer header, one single-flight refresh + replay on 401,
 * errors normalised to ApiError, cancellation via AbortSignal and a hard timeout.
 */
export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: FetchOptions['query']) {
  const base = API_PREFIX.startsWith('http') ? API_PREFIX : `${window.location.origin}${API_PREFIX}`;
  const url = new URL(`${base}${path}`);
  if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  return url.toString();
}

async function rawFetch(path: string, opts: FetchOptions, accept: string): Promise<Response> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? config.timeoutMs);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const headers = new Headers({ Accept: accept, 'X-Correlation-Id': crypto.randomUUID() });
  const token = tokenStore.getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body: BodyInit | undefined;
  if (opts.formData) body = opts.formData; // browser sets the multipart boundary
  else if (opts.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  try {
    return await fetch(buildUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body, signal });
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    const timedOut = e instanceof DOMException && e.name === 'TimeoutError';
    throw new ApiError({ status: 0, message: timedOut ? 'The request timed out. Please try again.' : 'Cannot reach the server.', isNetworkError: true, isTimeout: timedOut });
  }
}

async function request(path: string, opts: FetchOptions, accept: string): Promise<Response> {
  let res = await rawFetch(path, opts, accept);
  if (res.status === 401 && tokenStore.getRefreshToken()) {
    await refreshSession(); // throws ApiError (and emits session-expired) if the refresh token is no longer valid
    res = await rawFetch(path, opts, accept);
  }
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error */
    }
    throw new ApiError({
      status: res.status,
      message: body.message ?? res.statusText ?? `Request failed (${res.status})`,
      details: body.details,
      path: body.path,
      correlationId: res.headers.get('x-correlation-id') ?? undefined,
    });
  }
  return res;
}

export async function fetchJson<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const res = await request(path, opts, 'application/json');
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface DownloadedFile {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

export async function fetchBlob(path: string, opts: FetchOptions = {}): Promise<DownloadedFile> {
  const res = await request(path, opts, '*/*');
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return { blob: await res.blob(), fileName: m ? decodeURIComponent(m[1]) : 'download', mimeType: res.headers.get('content-type') ?? 'application/octet-stream' };
}

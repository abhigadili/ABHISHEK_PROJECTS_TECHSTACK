import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorBody, Envelope } from '@/types';

/**
 * Browser-side API client (Axios). It talks to Next's same-origin BFF route handler (`/api/backend/*`), which attaches the
 * HttpOnly access token and forwards to Express. The browser therefore never sees a token and no CORS configuration is needed.
 */
export const api = axios.create({ baseURL: '/api/backend', timeout: 20_000, headers: { Accept: 'application/json' } });
type Retryable = AxiosRequestConfig & { _retried?: boolean };

// Single-flight session refresh for the browser: concurrent 401s await ONE POST /api/session/refresh.
let refreshing: Promise<void> | null = null;
const refreshSession = () => (refreshing ??= axios.post('/api/session/refresh').then(() => undefined).finally(() => { refreshing = null; }));

api.interceptors.response.use((r) => r, async (error: AxiosError<{ error?: ApiErrorBody }>) => {
  const cfg = error.config as Retryable | undefined;
  if (error.response?.status === 401 && cfg && !cfg._retried) {
    cfg._retried = true;
    try { await refreshSession(); return api(cfg); }
    catch { if (typeof window !== 'undefined') window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}&reason=expired`); }
  }
  return Promise.reject(error);
});

export class ApiError extends Error { constructor(message: string, public code: string, public status: number, public fields?: Record<string, string>) { super(message); } }
export const toApiError = (e: unknown): ApiError => {
  if (e instanceof ApiError) return e;
  const ax = e as AxiosError<{ error?: ApiErrorBody }>; const b = ax?.response?.data?.error;
  if (b) return new ApiError(b.message, b.code, ax.response!.status, b.fields);
  if (axios.isCancel(e)) return new ApiError('Request cancelled', 'CANCELLED', 0);
  if (ax?.code === 'ECONNABORTED') return new ApiError('The server took too long to respond.', 'TIMEOUT', 0);
  if (ax?.isAxiosError) return new ApiError('Cannot reach the server. Check your connection.', 'NETWORK', 0);
  return new ApiError((e as Error)?.message ?? 'Something went wrong', 'UNKNOWN', 0);
};

type Params = Record<string, string | number | boolean | undefined>;
export const get = async <T>(url: string, params?: Params, signal?: AbortSignal) => (await api.get<Envelope<T>>(url, { params, signal })).data;
export const post = async <T>(url: string, body?: unknown) => (await api.post<Envelope<T>>(url, body)).data.data;
export const put = async <T>(url: string, body?: unknown) => (await api.put<Envelope<T>>(url, body)).data.data;
export const patch = async <T>(url: string, body?: unknown) => (await api.patch<Envelope<T>>(url, body)).data.data;
export const del = async <T = unknown>(url: string) => (await api.delete<Envelope<T>>(url)).data.data;

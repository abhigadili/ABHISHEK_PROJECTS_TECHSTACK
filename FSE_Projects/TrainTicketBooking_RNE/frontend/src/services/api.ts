import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorBody, Envelope, User } from '@/types';
import { tokenStore } from './tokenStore';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api', withCredentials: true, timeout: 20_000 });
type Retryable = AxiosRequestConfig & { _retried?: boolean };

/** Hook for the app to react when the session is definitively lost (refresh failed) - set by the store. */
let onSessionExpired: () => void = () => {};
export const setSessionExpiredHandler = (fn: () => void) => { onSessionExpired = fn; };

// Single-flight refresh: while one /auth/refresh is running every other 401 waits for the SAME promise,
// so a burst of parallel requests never rotates the (single-use) refresh token twice.
let refreshing: Promise<string> | null = null;
export const refreshSession = (): Promise<{ user: User; accessToken: string }> =>
  axios.post<Envelope<{ user: User; accessToken: string }>>(`${api.defaults.baseURL}/auth/refresh`, null, { withCredentials: true }).then((r) => r.data.data);
const refreshOnce = () => (refreshing ??= refreshSession().then((d) => { tokenStore.set(d.accessToken); return d.accessToken; }).finally(() => { refreshing = null; }));

api.interceptors.request.use((cfg) => { const t = tokenStore.get(); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });
api.interceptors.response.use((r) => r, async (error: AxiosError<{ error?: ApiErrorBody }>) => {
  const cfg = error.config as Retryable | undefined;
  const isAuthCall = cfg?.url?.startsWith('/auth/') && !cfg.url.startsWith('/auth/me') && !cfg.url.startsWith('/auth/change');
  if (error.response?.status === 401 && cfg && !cfg._retried && !isAuthCall && error.response.data?.error?.code !== 'ACCOUNT_LOCKED') {
    cfg._retried = true;
    try { const t = await refreshOnce(); cfg.headers = { ...cfg.headers, Authorization: `Bearer ${t}` } as never; return api(cfg); }
    catch { tokenStore.set(null); onSessionExpired(); }
  }
  return Promise.reject(error);
});

/** Normalised error for the UI: a message plus per-field messages for forms. */
export class ApiError extends Error { constructor(message: string, public code: string, public status: number, public fields?: Record<string, string>) { super(message); } }
export const toApiError = (e: unknown): ApiError => {
  if (e instanceof ApiError) return e;
  const ax = e as AxiosError<{ error?: ApiErrorBody }>; const b = ax?.response?.data?.error;
  if (b) return new ApiError(b.message, b.code, ax.response!.status, b.fields);
  if (ax?.code === 'ECONNABORTED') return new ApiError('The server took too long to respond.', 'TIMEOUT', 0);
  if (ax?.isAxiosError) return new ApiError('Cannot reach the server. Check your connection.', 'NETWORK', 0);
  return new ApiError((e as Error)?.message ?? 'Something went wrong', 'UNKNOWN', 0);
};

export const get = async <T>(url: string, params?: object) => (await api.get<Envelope<T>>(url, { params })).data;
export const post = async <T>(url: string, body?: unknown) => (await api.post<Envelope<T>>(url, body)).data.data;
export const put = async <T>(url: string, body?: unknown) => (await api.put<Envelope<T>>(url, body)).data.data;
export const patch = async <T>(url: string, body?: unknown) => (await api.patch<Envelope<T>>(url, body)).data.data;
export const del = async <T = unknown>(url: string) => (await api.delete<Envelope<T>>(url)).data.data;

import axios, { AxiosError } from 'axios';
/** Browser-side API client (Axios) for the REST API of THIS app (/api/v1). Cookies are same-origin and HttpOnly - no token handling in JS. */
export class ApiClientError extends Error { constructor(public status: number, message: string, public fields?: Record<string, string>) { super(message); } }
export const http = axios.create({ baseURL: '/api/v1', timeout: 20000, headers: { Accept: 'application/json' } });
interface Env<T> { success: boolean; data: T; meta?: { page: number; size: number; total: number; totalPages: number }; error?: { message: string; fields?: Record<string, string> } }
http.interceptors.response.use((r) => r, (err: AxiosError<Env<never>>) => {
  if (axios.isCancel(err)) return Promise.reject(err);
  const s = err.response?.status ?? 0; const e = err.response?.data?.error;
  if (s === 401 && typeof window !== 'undefined') { // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }
  return Promise.reject(new ApiClientError(s, e?.message ?? (s ? `Request failed (${s})` : 'Network error'), e?.fields));
});
export const get = async <T,>(url: string, params?: object, signal?: AbortSignal) => (await http.get<Env<T>>(url, { params, signal })).data;
export const send = async <T,>(method: 'post' | 'put' | 'patch' | 'delete', url: string, data?: unknown) => (await http.request<Env<T>>({ method, url, data })).data;

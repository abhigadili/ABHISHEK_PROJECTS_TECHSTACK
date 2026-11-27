import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { config } from '@/app/config/env';
import { tokens } from './tokens';
import { ApiError, type FieldError } from './errors';
import { useConnectionStore } from '@/store/zustand/connectionStore';

export const http = axios.create({ baseURL: config.axiosBase, timeout: 30_000 });

const AUTH_FREE = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/forgot-password', '/api/v1/auth/reset-password'];
const isAuthFree = (url?: string) => !!url && AUTH_FREE.some((p) => url.includes(p));

http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (tokens.access && !isAuthFree(cfg.url)) cfg.headers.set('Authorization', `Bearer ${tokens.access}`);
  return cfg;
});

/** Single-flight refresh: concurrent 401s share one refresh call (refresh tokens rotate; reuse revokes the family). */
let refreshing: Promise<string> | null = null;
async function refreshAccessToken(): Promise<string> {
  const rt = tokens.refresh;
  if (!rt) throw new Error('no refresh token');
  if (!refreshing) {
    refreshing = axios
      .post(`${config.axiosBase}/api/v1/auth/refresh`, { refreshToken: rt }, { timeout: 15_000 })
      .then((r) => {
        tokens.set(r.data.accessToken, r.data.refreshToken);
        return r.data.accessToken as string;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

function normalise(err: AxiosError<any>): ApiError {
  if (!err.response) {
    const timeout = err.code === 'ECONNABORTED';
    return new ApiError({ status: 0, network: true, message: timeout ? 'The server took too long to respond.' : 'Cannot reach the HR API. Check that the backend gateway is running.' });
  }
  const d = err.response.data;
  let fieldErrors: FieldError[] = [];
  if (Array.isArray(d?.fieldErrors)) fieldErrors = d.fieldErrors.map((f: any) => ({ field: String(f.field ?? ''), message: String(f.message ?? f.defaultMessage ?? 'Invalid') }));
  else if (d?.fieldErrors && typeof d.fieldErrors === 'object') fieldErrors = Object.entries(d.fieldErrors).map(([field, message]) => ({ field, message: String(message) }));
  const fallback: Record<number, string> = { 401: 'Your session has expired.', 403: 'You do not have permission to do that.', 404: 'Not found.', 429: 'Too many requests - please slow down.', 502: 'The service is unavailable.', 503: 'The service is unavailable.' };
  return new ApiError({
    status: err.response.status,
    code: d?.code,
    message: (typeof d === 'object' && d?.message) || fallback[err.response.status] || `Request failed (${err.response.status})`,
    fieldErrors,
    correlationId: d?.correlationId,
  });
}

http.interceptors.response.use(
  (r) => { useConnectionStore.getState().setOnline(true); return r; },
  async (error: AxiosError<any>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried && !isAuthFree(original.url) && tokens.refresh) {
      original._retried = true;
      try {
        const at = await refreshAccessToken();
        original.headers = { ...(original.headers as any), Authorization: `Bearer ${at}` };
        return http.request(original);
      } catch {
        tokens.forceLogout();
        return Promise.reject(new ApiError({ status: 401, message: 'Your session has expired. Please sign in again.' }));
      }
    }
    if (error.response?.status === 401 && !isAuthFree(original?.url)) tokens.forceLogout();
    const n = normalise(error);
    if (n.network) useConnectionStore.getState().setOnline(false, n.message);
    else useConnectionStore.getState().setOnline(true);
    return Promise.reject(n);
  },
);

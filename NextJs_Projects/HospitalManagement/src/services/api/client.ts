import axios, { AxiosError } from 'axios';
import { ApiError } from '@/lib/utilities/api-error';
import type { ApiErrorBody } from '@/types';

/**
 * Client-side API client (Axios). The browser never talks to the Node.js gateway directly and never sees a token:
 * it calls the Next.js BFF pass-through (/api/backend/*) which attaches the HttpOnly-cookie JWT server-side.
 */
export const http = axios.create({ baseURL: '/api/backend', timeout: 20000, headers: { Accept: 'application/json' } });

let redirecting = false;
http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(err)) return Promise.reject(err); // request cancellation (AbortController) is not an error
    if (!err.response) return Promise.reject(new ApiError(0, err.code === 'ECONNABORTED' ? 'The request timed out' : 'Network error - check your connection', [], true));
    const e = ApiError.fromBody(err.response.status, err.response.data);
    if (e.status === 401 && typeof window !== 'undefined' && !redirecting) {
      redirecting = true; // session expired and refresh failed: leave through the login page, keep the return path
      // full navigation on purpose: the session is gone, so every client cache/state must be discarded
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?reason=expired&next=${encodeURIComponent(window.location.pathname)}`);
    }
    return Promise.reject(e);
  },
);
export const unwrap = async <T>(p: Promise<{ data: T }>) => (await p).data;

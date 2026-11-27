import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_PREFIX, config } from '@/constants/config';
import { tokenStore } from './tokenStore';
import { refreshSession } from './refresh';
import { toApiError, isAbortError } from './errors';
import { forbiddenChannel, sessionExpiredChannel } from './authEvents';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Skip bearer header + refresh handling (login/register). */
    skipAuth?: boolean;
    /** Max automatic retries for idempotent GETs (network errors, 502/503/504). */
    retry?: number;
  }
  interface InternalAxiosRequestConfig {
    _retried?: boolean;
    _retryCount?: number;
  }
}

/**
 * Central Axios instance for the API gateway.
 *  - request interceptor : bearer token + X-Correlation-Id
 *  - response interceptor: 401 -> single-flight refresh + replay, 403 -> event, GET retry with back-off,
 *                          every failure is converted to ApiError (global API error handling)
 */
export const apiClient = axios.create({
  baseURL: API_PREFIX,
  timeout: config.timeoutMs,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const newCorrelationId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now()));

apiClient.interceptors.request.use((req: InternalAxiosRequestConfig) => {
  req.headers.set('X-Correlation-Id', newCorrelationId());
  if (!req.skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token) req.headers.set('Authorization', `Bearer ${token}`);
  }
  return req;
});

const RETRYABLE = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (isAbortError(error)) throw error; // request cancellation is not an application error
    const req = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status;

    // Retry mechanism: idempotent GETs only, exponential back-off.
    if (req && req.method?.toLowerCase() === 'get' && (req.retry ?? 1) > (req._retryCount ?? 0) && (!error.response || RETRYABLE.has(status ?? 0))) {
      req._retryCount = (req._retryCount ?? 0) + 1;
      await sleep(300 * 2 ** (req._retryCount - 1));
      return apiClient(req);
    }

    // Token renewal: one refresh, one replay.
    if (status === 401 && req && !req.skipAuth && !req._retried && tokenStore.getRefreshToken()) {
      req._retried = true;
      try {
        await refreshSession();
        return apiClient(req);
      } catch {
        /* refreshSession already cleared the session and emitted the event */
      }
    } else if (status === 401 && req && !req.skipAuth) {
      tokenStore.clear();
      sessionExpiredChannel.emit();
    }

    if (status === 403) forbiddenChannel.emit();
    throw toApiError(error);
  },
);

export type { AxiosRequestConfig } from 'axios';

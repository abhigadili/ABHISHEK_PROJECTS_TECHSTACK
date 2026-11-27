import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/constants/env';
import { tokenStore } from './tokenStore';
import { ApiError, toApiError } from './errors';
import type { TokenPair } from '@/types/api';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Caller handles the error itself (e.g. a form showing field errors) → no global toast. */
    skipGlobalError?: boolean;
    /** Internal: request was already retried once after a token refresh (prevents refresh loops). */
    _retried?: boolean;
  }
}

/* ------------------------------------------------------------------ hooks registered by the app shell */
type Notifier = (message: string) => void;
let notifyError: Notifier = () => undefined;
let onSessionExpired: () => void = () => undefined;
export const registerErrorNotifier = (fn: Notifier) => {
  notifyError = fn;
};
export const registerSessionExpiredHandler = (fn: () => void) => {
  onSessionExpired = fn;
};
export const handleSessionExpired = () => {
  tokenStore.clear();
  onSessionExpired();
};

/* ------------------------------------------------------------------ helpers */
/**
 * Endpoints that must never carry a Bearer token and must never trigger a refresh. EXACT match (ignoring any query string):
 * a prefix match would wrongly include `/auth/logout-all`, which DOES require a valid access token.
 */
const AUTH_PATHS = new Set([
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);
const isAuthPath = (url?: string) => !!url && AUTH_PATHS.has(url.split('?')[0]);

/** Tokens are only attached to requests that target OUR backend (relative path or the configured base URL). */
const isBackendRequest = (config: InternalAxiosRequestConfig) => {
  const url = config.url ?? '';
  if (!/^https?:\/\//i.test(url)) return true;
  return url.startsWith(env.apiBaseUrl);
};

const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* De-duplicate global toasts: the same message is shown at most once per 3 seconds (e.g. 10 parallel requests all failing). */
const recentToasts = new Map<string, number>();
function toastOnce(message: string) {
  const now = Date.now();
  if ((recentToasts.get(message) ?? 0) > now - 3000) return;
  recentToasts.set(message, now);
  notifyError(message);
}

/* ------------------------------------------------------------------ single-flight token refresh */
/** A bare client (no interceptors) so the refresh call can never recurse into the 401 handler. */
const bare: AxiosInstance = axios.create({ baseURL: env.apiBaseUrl, timeout: env.requestTimeoutMs });
let refreshInFlight: Promise<string> | null = null;

/**
 * Refresh tokens ROTATE on the backend and re-use revokes the whole family, so two concurrent refreshes would log the user out.
 * Every caller (Axios interceptor *and* the RTK Query base query) therefore shares one promise.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken)
        throw new ApiError({ status: 401, code: 'NO_REFRESH_TOKEN', message: 'Not signed in' });
      try {
        const { data } = await bare.post<{ data: TokenPair }>('/auth/refresh', { refreshToken });
        tokenStore.setTokens(data.data);
        return data.data.accessToken;
      } catch (e) {
        const err = e as AxiosError;
        throw toApiError(err.response?.status ?? 0, err.response?.data);
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/* ------------------------------------------------------------------ the shared client */
export const http: AxiosInstance = axios.create({ baseURL: env.apiBaseUrl, timeout: env.requestTimeoutMs });

// 1) request interceptor: Authorization header + correlation id
http.interceptors.request.use((config) => {
  if (isBackendRequest(config) && !isAuthPath(config.url)) {
    const token = tokenStore.getAccess();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  // The backend's CORS allow-list only permits Content-Type/Authorization, so a custom header is safe only for same-origin calls.
  if (env.apiBaseUrl.startsWith('/')) config.headers.set('X-Request-Id', newRequestId());
  return config;
});

// 2) response interceptor: refresh on 401, normalise every failure into ApiError
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error)) throw error; // aborted by the caller (useApi cleanup): not an error
    const err = error as AxiosError;
    const config = err.config;
    const status = err.response?.status ?? 0;

    if (status === 401 && config && !config._retried && !isAuthPath(config.url) && tokenStore.hasRefresh()) {
      try {
        await refreshSession();
        config._retried = true;
        return http.request(config); // replay the ORIGINAL request with the new token (request interceptor re-attaches it)
      } catch {
        handleSessionExpired(); // refresh failed → the session is unrecoverable → logout
        throw toApiError(401, err.response?.data);
      }
    }

    const apiError = toApiError(
      status,
      err.response?.data,
      err.code === 'ECONNABORTED' ? 'The request timed out.' : undefined,
    );
    if (!config?.skipGlobalError && !isAuthPath(config?.url)) {
      // 404/409/422/400 are expected business outcomes that the calling screen presents; only systemic errors toast globally.
      if (status === 403 || status === 429 || status >= 500 || status === 0) toastOnce(apiError.message);
      if (status === 401) handleSessionExpired();
    }
    throw apiError;
  },
);

export const isCancel = axios.isCancel;

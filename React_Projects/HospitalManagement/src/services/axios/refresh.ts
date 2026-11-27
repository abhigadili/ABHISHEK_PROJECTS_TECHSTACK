import axios from 'axios';
import { API_PREFIX, config } from '@/constants/config';
import type { TokenResponse } from '@/types';
import { tokenStore } from './tokenStore';
import { toApiError } from './errors';
import { sessionExpiredChannel } from './authEvents';

/** Bare axios instance (no interceptors) used only for the refresh call, so it can never recurse. */
const bare = axios.create({ baseURL: API_PREFIX, timeout: config.timeoutMs, headers: { 'Content-Type': 'application/json' } });

let inflight: Promise<TokenResponse> | null = null;

/**
 * Single-flight token renewal. The backend rotates refresh tokens and treats re-use of an old one as theft (the whole
 * token family is revoked), so concurrent 401s MUST share one refresh call.
 */
export function refreshSession(): Promise<TokenResponse> {
  if (inflight) return inflight;
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(toApiError(new Error('No refresh token')));
  }
  inflight = bare
    .post<TokenResponse>('/auth/refresh', { refreshToken })
    .then((r) => {
      tokenStore.set(r.data);
      return r.data;
    })
    .catch((e) => {
      tokenStore.clear();
      sessionExpiredChannel.emit();
      throw toApiError(e);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

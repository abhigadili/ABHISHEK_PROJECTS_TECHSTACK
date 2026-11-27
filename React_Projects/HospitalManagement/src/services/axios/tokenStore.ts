import type { TokenResponse } from '@/types';

/**
 * Token storage policy
 * --------------------
 * The existing backend returns BOTH tokens in the JSON body of /api/auth/login and /api/auth/refresh. It does not set
 * an HttpOnly refresh cookie, so the "prefer HttpOnly cookie" recommendation cannot be followed (documented in
 * API_INTEGRATION_DOCUMENTATION.md). To keep exposure minimal:
 *   - the short-lived (15 min) access token lives ONLY in module memory and is never written to any storage;
 *   - the rotating refresh token lives in sessionStorage (tab-scoped, cleared when the tab closes, never localStorage)
 *     so that a page reload can silently restore the session. It is single-use (rotation + reuse detection).
 */
const REFRESH_KEY = 'hms.session.rt';

let accessToken: string | null = null;
let accessTokenExpiresAt = 0;

export const tokenStore = {
  getAccessToken: () => accessToken,
  getAccessTokenExpiresAt: () => accessTokenExpiresAt,
  getRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(tokens: Pick<TokenResponse, 'accessToken' | 'refreshToken' | 'expiresInSeconds'>) {
    accessToken = tokens.accessToken;
    accessTokenExpiresAt = Date.now() + tokens.expiresInSeconds * 1000;
    try {
      sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      /* storage blocked: session simply will not survive a reload */
    }
  },
  clear() {
    accessToken = null;
    accessTokenExpiresAt = 0;
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

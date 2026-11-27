/**
 * Where the session tokens live.
 *  - access token : module memory only (15-minute lifetime; never persisted, so an XSS dump of storage cannot read it)
 *  - refresh token: localStorage so a page reload can silently restore the session.
 * The backend returns tokens in the JSON body (no HttpOnly cookie), so this is the least-bad option; the trade-off is documented
 * in docs/react-concepts/17-axios-interceptors.md.
 */
const REFRESH_KEY = 'ems.refreshToken';
let accessToken: string | null = null;

const read = (): string | null => {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
};

export const tokenStore = {
  getAccess: () => accessToken,
  getRefresh: read,
  hasRefresh: () => read() !== null,
  setTokens(tokens: { accessToken: string; refreshToken: string }) {
    accessToken = tokens.accessToken;
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  },
  clear() {
    accessToken = null;
    try {
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

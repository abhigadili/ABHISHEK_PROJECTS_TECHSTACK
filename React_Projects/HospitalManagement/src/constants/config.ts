/** Runtime configuration read from Vite env (see .env.example). */
const bool = (v: string | undefined, d: boolean) => (v === undefined ? d : v === 'true');
const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:30080',
  /** When true the browser talks to its own origin and Vite proxies /api to the gateway. */
  useProxy: bool(import.meta.env.VITE_USE_PROXY as string | undefined, true),
  timeoutMs: num(import.meta.env.VITE_API_TIMEOUT_MS as string | undefined, 20000),
  idleLogoutMinutes: num(import.meta.env.VITE_IDLE_LOGOUT_MINUTES as string | undefined, 30),
} as const;

/** Base URL for HTTP clients: '' (same origin, proxied) or the absolute gateway URL. */
export const API_ORIGIN = config.useProxy ? '' : config.apiBaseUrl;
export const API_PREFIX = `${API_ORIGIN}/api`;

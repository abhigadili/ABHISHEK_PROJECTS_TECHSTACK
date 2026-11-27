const raw = import.meta.env;
export const config = {
  apiBaseUrl: (raw.VITE_API_BASE_URL as string) || 'http://localhost:9080',
  useProxy: String(raw.VITE_USE_PROXY ?? 'true') === 'true',
  title: (raw.VITE_APP_TITLE as string) || 'HR Portal',
  /** Axios baseURL: '' = same origin (proxied), otherwise the gateway URL. */
  get axiosBase() { return this.useProxy ? '' : this.apiBaseUrl; },
};

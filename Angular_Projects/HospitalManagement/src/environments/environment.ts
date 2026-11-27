/** Development configuration (default file). No secrets: only non-sensitive URLs and feature flags. */
export const environment = {
  production: false,
  /** Gateway of the existing Node.js backend (verified: :30080). '' = same origin, `ng serve` proxies /api (proxy.conf.json). */
  apiBaseUrl: '',
  /** Zoneless change detection (Angular 19: experimental API). false = classic zone.js-based detection. */
  zoneless: true,
  idleLogoutMinutes: 30,
  apiTimeoutMs: 20000,
};

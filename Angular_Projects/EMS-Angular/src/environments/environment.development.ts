/** Development: `ng serve` proxies /api to the Express backend (see proxy.conf.json), so no CORS change is needed. */
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  apiTimeoutMs: 30000,
  notificationPollMs: 30000,
};

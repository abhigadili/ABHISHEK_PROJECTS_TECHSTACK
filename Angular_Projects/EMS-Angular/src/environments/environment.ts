/** Production defaults. `apiBaseUrl` is same-origin so a reverse proxy (nginx etc.) can route /api to the Express backend. */
export const environment = {
  production: true,
  apiBaseUrl: '/api/v1',
  apiTimeoutMs: 30000,
  notificationPollMs: 60000,
};

/** Development: the Angular dev server proxies /api to the existing Express backend (see proxy.conf.json), so the refresh cookie stays same-origin. */
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  notificationPollSeconds: 60,
  enableHttpLogging: true,
};

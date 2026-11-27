/** Production: serve the built app behind the same origin as the API (reverse proxy /api -> Express) so the HttpOnly refresh cookie works. */
export const environment = {
  production: true,
  apiBaseUrl: '/api',
  notificationPollSeconds: 60,
  enableHttpLogging: false,
};

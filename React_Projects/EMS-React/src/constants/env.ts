/** Browser-visible configuration. Everything here is bundled into the client: never put secrets in VITE_ variables. */
export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, ''),
  appName: import.meta.env.VITE_APP_NAME ?? 'EMS',
  isDev: import.meta.env.DEV,
  requestTimeoutMs: 15000,
  defaultPageSize: 10,
  notificationPollMs: 30000,
} as const;

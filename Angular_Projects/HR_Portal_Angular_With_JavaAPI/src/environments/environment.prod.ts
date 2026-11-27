/** Production configuration: serve `dist/` and a reverse proxy (`location /api/ { proxy_pass <gateway>; }`) from one host. */
export const environment = {
  production: true,
  appName: 'HR Portal',
  gatewayUrl: 'http://localhost:9080',
  useProxy: true,
  get apiBaseUrl(): string { return this.useProxy ? '' : this.gatewayUrl; },
};

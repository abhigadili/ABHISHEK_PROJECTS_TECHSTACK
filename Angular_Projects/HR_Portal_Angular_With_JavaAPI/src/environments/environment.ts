/**
 * Development configuration. The browser always calls same-origin `/api/...`; `ng serve` (proxy.conf.cjs) forwards it to the
 * Java API gateway at `gatewayUrl` (the HR_Portal_API gateway listens on 9080 - NOT 8080).
 * Set `useProxy: false` to call `gatewayUrl` directly (then the gateway's HR_CORS_ORIGINS must allow this origin).
 */
export const environment = {
  production: false,
  appName: 'HR Portal',
  gatewayUrl: 'http://localhost:9080',
  useProxy: true,
  get apiBaseUrl(): string { return this.useProxy ? '' : this.gatewayUrl; },
};

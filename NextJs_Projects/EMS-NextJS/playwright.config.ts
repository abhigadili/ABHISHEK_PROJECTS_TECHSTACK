import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a Next.js server YOU start (production build, `next start -p 3100`) that talks to the ISOLATED TEST backend
 * (:4101 → *_test database). We deliberately don't auto-start a server: a silently reused server could point at the dev database.
 *   E2E_BASE_URL=http://localhost:3100  E2E_CHANNEL=chrome  npm run e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', channel: process.env.E2E_CHANNEL || undefined },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_CHANNEL || undefined } }],
});

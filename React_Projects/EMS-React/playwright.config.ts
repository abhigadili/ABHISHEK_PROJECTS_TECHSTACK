import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against a REAL isolated test backend (never the dev DB):
 *   backend (EMS-ExpressJS) started with NODE_ENV=test PORT=4101  →  Vite dev server on 5174 proxying /api to it.
 * See README.md → Testing for the exact commands. System Chrome is used (`E2E_CHANNEL=chrome`) because Playwright's bundled
 * Chromium does not support this Ubuntu release.
 */
const channel = process.env.E2E_CHANNEL;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    env: { VITE_BACKEND_URL: process.env.E2E_BACKEND_URL ?? 'http://localhost:4101' },
  },
});

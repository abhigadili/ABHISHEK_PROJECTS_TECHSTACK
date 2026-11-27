import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the Angular dev server (proxying to an ISOLATED test backend on :4101) — never a production database.
 * Start the test backend + seed first (see README → "E2E tests").
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // E2E_CHANNEL=chrome uses the installed Google Chrome (needed on OSes Playwright's bundled Chromium doesn't support).
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(process.env['E2E_CHANNEL'] ? { channel: process.env['E2E_CHANNEL'] } : {}) } }],
  webServer: {
    command: 'npx ng serve --configuration e2e --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 240_000,
  },
});

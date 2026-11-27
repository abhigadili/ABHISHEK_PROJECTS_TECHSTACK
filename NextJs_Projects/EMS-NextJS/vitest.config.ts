import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': r('./src'), 'server-only': r('./tests/stubs/server-only.ts') } }, // `server-only` throws outside the Next server build; stubbed for unit tests
  test: {
    environment: 'node', // component tests opt in with `// @vitest-environment jsdom`
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    env: { EMS_API_URL: 'http://api.test/api/v1', EMS_REVALIDATE_SECRET: 'unit-test-secret-0123456789', EMS_API_TIMEOUT_MS: '5000' },
  },
});

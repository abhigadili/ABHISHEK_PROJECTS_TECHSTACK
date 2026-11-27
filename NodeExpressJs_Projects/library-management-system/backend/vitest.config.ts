import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    fileParallelism: false,           // all files share one MySQL test database
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'library_management_test',
      RATE_LIMIT_ENABLED: 'false',
      JOBS_ENABLED: 'false',
      EXPOSE_RESET_LINK: 'true',
      SEED_ADMIN_PASSWORD: 'Test#Pass123',
      MAX_UPLOAD_BYTES: '200000',
      FRONTEND_ORIGIN: 'http://localhost:3000',
      APP_BASE_URL: 'http://localhost:3000',
    },
  },
});

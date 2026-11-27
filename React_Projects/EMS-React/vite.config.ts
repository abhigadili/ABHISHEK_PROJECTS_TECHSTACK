/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The dev server proxies /api to the existing Express backend, so the browser sees a single origin:
// no CORS pre-flight and no need to change the backend's CORS allow-list.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://localhost:4100';
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: 5173, proxy: { '/api': { target: backend, changeOrigin: true } } },
    preview: { port: 5173, proxy: { '/api': { target: backend, changeOrigin: true } } },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            charts: ['recharts'],
            state: ['@reduxjs/toolkit', 'react-redux'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      // tests talk to an absolute fake origin intercepted by msw (Node's fetch can't resolve relative URLs)
      env: { VITE_API_BASE_URL: 'http://api.test/api/v1' },
      testTimeout: 15000,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['e2e/**', 'node_modules/**'],
    },
  };
});

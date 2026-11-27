import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Dev & preview servers proxy /api to the Java API gateway so the browser never needs CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_BASE_URL || 'http://localhost:9080';
  // The proxy makes the browser call same-origin, so the Origin header is dropped before forwarding
  // (otherwise the gateway's CORS filter rejects origins it was not configured for, e.g. the preview port).
  const proxy = { '/api': { target, changeOrigin: true, configure: (p: any) => { p.on('proxyReq', (req: any) => req.removeHeader('origin')); } } };
  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    css: { preprocessorOptions: { scss: { api: 'modern-compiler', silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'mixed-decls'] } } },
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            charts: ['recharts'],
            editor: ['jodit-react', 'jodit'],
            export: ['xlsx', 'jspdf', 'jspdf-autotable'],
            state: ['@reduxjs/toolkit', 'react-redux', 'zustand', '@tanstack/react-query', '@tanstack/react-table'],
            forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
            i18n: ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            motion: ['motion'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});

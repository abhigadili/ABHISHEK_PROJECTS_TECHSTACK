import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), '@shared': path.resolve(__dirname, '../backend/src') } },
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: false } } },
  preview: { port: 5174, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000' } } },
  build: { chunkSizeWarningLimit: 900 },
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The gateway of the existing Node.js backend (verified: http://localhost:30080).
  const target = env.VITE_API_BASE_URL || 'http://localhost:30080';
  const proxy = {
    '/api': { target, changeOrigin: true },
  };
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // `VITE_PROFILING=true npm run build` links the profiling build of react-dom so <Profiler> reports in production too.
        ...(env.VITE_PROFILING === 'true' ? { 'react-dom/client': 'react-dom/profiling' } : {}),
      },
    },
    server: { port: 5180, strictPort: false, proxy },
    preview: { port: 5181, proxy },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Bundle optimisation: vendor code is split into long-lived, cacheable chunks.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
            if (id.includes('@radix-ui')) return 'vendor-radix';
            if (id.includes('@tanstack')) return 'vendor-tanstack';
            if (id.includes('react-router')) return 'vendor-router';
            if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('zustand') || id.includes('immer')) return 'vendor-state';
            if (id.includes('formik') || id.includes('react-hook-form') || id.includes('@hookform') || id.includes('yup') || id.includes('zod')) return 'vendor-forms';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
  };
});

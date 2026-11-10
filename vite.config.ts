import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const backendEnv = loadEnv(
    mode,
    path.resolve(import.meta.dirname, 'backend'),
    'VITE_'
  );
  return {
    root: path.resolve(import.meta.dirname, 'frontend'),
    envDir: path.resolve(import.meta.dirname, '.'),
    publicDir: path.resolve(import.meta.dirname, 'frontend/public'),
    build: {
      outDir: path.resolve(import.meta.dirname, 'frontend/dist'),
      emptyOutDir: true,
    },
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_NEON_AUTH_URL': JSON.stringify(
        backendEnv.VITE_NEON_AUTH_URL || process.env.VITE_NEON_AUTH_URL || ''
      ),
      'import.meta.env.VITE_NEON_REALTIME_URL': JSON.stringify(
        backendEnv.VITE_NEON_REALTIME_URL || process.env.VITE_NEON_REALTIME_URL || ''
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'frontend'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

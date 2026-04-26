import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint2';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    eslint({
      lintOnStart: true,
      emitErrorAsWarning: true, // n'empêche pas le démarrage du dev server
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
  server: {
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
    // Le projet est dans un dossier OneDrive : les events fs natifs sont
    // intermittents → on force le polling pour que HMR fonctionne de façon
    // fiable. 100 ms = bon compromis réactivité/CPU sur Windows.
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
  },
});

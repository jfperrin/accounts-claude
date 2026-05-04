import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint2';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    eslint({
      lintOnStart: true,
      emitErrorAsWarning: true, // n'empêche pas le démarrage du dev server
    }),
    VitePWA({
      // 'prompt' : on affiche une bannière à l'utilisateur quand un nouveau SW
      // attend, plutôt que de recharger silencieusement.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Gestion de Comptes',
        short_name: 'Comptes',
        description: 'Suivi de comptes bancaires, opérations et budgets.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#6366f1',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Exclut les routes API et uploads du fallback SPA — sinon une réponse
        // d'index.html serait servie en cas d'offline pour ces requêtes.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          // Avatars : cache 1 semaine, network-first pour rester à jour quand on est en ligne.
          {
            urlPattern: /^\/uploads\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'uploads-v1',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
      // En dev on garde le SW désactivé : sinon Vite HMR entre en conflit
      // avec les assets précachés.
      devOptions: { enabled: false },
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

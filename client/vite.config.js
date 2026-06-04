import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint2';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// recharts importe les helpers via les chemins profonds CJS d'es-toolkit
// (`es-toolkit/compat/<name>`). esbuild génère un shim avec une collision
// `var require_isUnsafeProperty = require_isUnsafeProperty()` à l'intérieur
// d'un IIFE — la `var` hoistée masque la fonction externe → "is not a function".
// Solution : aliaser chaque chemin profond vers la version `.mjs` correspondante.
// On utilise des chemins absolus : les `.mjs` ne sont pas dans le champ exports
// du package, donc un specifier comme `es-toolkit/dist/...mjs` est rejeté par
// Vite — résoudre vers le fichier sur disque contourne le gating.
const esCompat = (subdir, name) => resolve(
  __dirname, 'node_modules/es-toolkit/dist/compat', subdir, `${name}.mjs`,
);
const esToolkitCompatMjsAlias = {
  'es-toolkit/compat/get':           esCompat('object',    'get'),
  'es-toolkit/compat/omit':          esCompat('object',    'omit'),
  'es-toolkit/compat/isPlainObject': esCompat('predicate', 'isPlainObject'),
  'es-toolkit/compat/last':          esCompat('array',     'last'),
  'es-toolkit/compat/sortBy':        esCompat('array',     'sortBy'),
  'es-toolkit/compat/uniqBy':        esCompat('array',     'uniqBy'),
  'es-toolkit/compat/throttle':      esCompat('function',  'throttle'),
  'es-toolkit/compat/maxBy':         esCompat('math',      'maxBy'),
  'es-toolkit/compat/minBy':         esCompat('math',      'minBy'),
  'es-toolkit/compat/range':         esCompat('math',      'range'),
  'es-toolkit/compat/sumBy':         esCompat('math',      'sumBy'),
};

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
    alias: {
      '@': resolve(__dirname, './src'),
      ...esToolkitCompatMjsAlias,
    },
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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import eslint from 'vite-plugin-eslint2';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// recharts importe les helpers via les chemins profonds CJS d'es-toolkit
// (`es-toolkit/compat/<name>` → `compat/<name>.js` qui re-require le CJS interne).
// Le CJS interne `dist/compat/<subdir>/<name>.js` contient des
// `const require_isUnsafeProperty = require(...)` qu'esbuild bundle dans un
// IIFE — collision avec la `var` hoistée → "is not a function" au runtime.
//
// Solution : plugin Vite qui réécrit chaque `es-toolkit/compat/<name>` en
// virtual module qui re-export l'export nommé du `.mjs` correspondant comme
// default (recharts importe en `import x from ...`).
const ES_COMPAT_MAP = {
  get:           ['object',    'get'],
  omit:          ['object',    'omit'],
  isPlainObject: ['predicate', 'isPlainObject'],
  last:          ['array',     'last'],
  sortBy:        ['array',     'sortBy'],
  uniqBy:        ['array',     'uniqBy'],
  throttle:      ['function',  'throttle'],
  maxBy:         ['math',      'maxBy'],
  minBy:         ['math',      'minBy'],
  range:         ['math',      'range'],
  sumBy:         ['math',      'sumBy'],
};
const ES_COMPAT_PREFIX = 'es-toolkit/compat/';

function esCompatAbsPath(name) {
  const [subdir, file] = ES_COMPAT_MAP[name];
  return resolve(
    __dirname, 'node_modules/es-toolkit/dist/compat', subdir, `${file}.mjs`,
  ).replace(/\\/g, '/');
}

// Plugin Vite — intercepte les imports `es-toolkit/compat/<name>` côté
// transform runtime (pour les modules `src/*` qui en importent indirectement
// au-delà de la pré-bundle).
function esCompatVitePlugin() {
  const VIRTUAL = '\0es-toolkit-compat:';
  return {
    name: 'es-toolkit-compat-default-export',
    enforce: 'pre',
    resolveId(id) {
      if (!id.startsWith(ES_COMPAT_PREFIX)) return null;
      const name = id.slice(ES_COMPAT_PREFIX.length);
      if (!ES_COMPAT_MAP[name]) return null;
      return VIRTUAL + name;
    },
    load(id) {
      if (!id.startsWith(VIRTUAL)) return null;
      const name = id.slice(VIRTUAL.length);
      const [, file] = ES_COMPAT_MAP[name];
      return `export { ${file} as default, ${file} } from ${JSON.stringify(esCompatAbsPath(name))};`;
    },
  };
}

// Plugin Rollup/rolldown — appliqué pendant la dependency optimization.
// Vite 8 utilise rolldown (pas esbuild) pour pré-bundler les deps, et les
// plugins Vite déclarés au top-level ne sont pas exécutés à cette phase.
// On passe la même logique via `optimizeDeps.rolldownOptions.plugins`.
function esCompatRolldownPlugin() {
  const VIRTUAL = '\0es-toolkit-compat:';
  return {
    name: 'es-toolkit-compat-default-export-rolldown',
    resolveId(id) {
      if (!id.startsWith(ES_COMPAT_PREFIX)) return null;
      const name = id.slice(ES_COMPAT_PREFIX.length);
      if (!ES_COMPAT_MAP[name]) return null;
      return VIRTUAL + name;
    },
    load(id) {
      if (!id.startsWith(VIRTUAL)) return null;
      const name = id.slice(VIRTUAL.length);
      const [, file] = ES_COMPAT_MAP[name];
      return `export { ${file} as default, ${file} } from ${JSON.stringify(esCompatAbsPath(name))};`;
    },
  };
}

export default defineConfig({
  plugins: [
    esCompatVitePlugin(),
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
  optimizeDeps: {
    rolldownOptions: {
      plugins: [esCompatRolldownPlugin()],
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.js'],
    globals: true,
  },
});

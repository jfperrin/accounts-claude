// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Tests E2E contre l'app complète (server + client). `webServer` lance
// `yarn dev` à la racine si rien n'écoute sur 5173.
//
// Pré-requis : variables ADMIN_EMAIL/ADMIN_PASSWORD posées côté server pour
// éviter une création admin pendant le run, et MFA_ENCRYPTION_KEY (64 hex).
// On garde le SQLite local par défaut (pas de MONGODB_URI dans l'env du run).

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false, // partage la même base SQLite : un test à la fois
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  // Lance `yarn dev` (server :3001 + client :5173) si rien n'écoute encore.
  // reuseExistingServer évite de spawn un 2e dev server si on tourne en local.
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'yarn dev',
    url: 'http://localhost:5173',
    cwd: '..',
    timeout: 60_000,
    reuseExistingServer: true,
    env: {
      MFA_ENCRYPTION_KEY: '0'.repeat(64),
      RATE_LIMIT_MAX: '1000',
      // Compte admin seedé au boot par ensureAdmin → utilisé par les tests pour
      // sauter la vérif email (qui requiert un vrai client SMTP en dev).
      ADMIN_EMAIL: 'e2e-admin@test.local',
      ADMIN_PASSWORD: 'e2eAdminPass123',
    },
  },
});

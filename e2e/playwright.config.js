// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

// Tests E2E contre l'app complète (server + client).
//
// Stratégie d'isolation :
//   - DB SQLite dans /tmp (pas de Mongo en production) → MONGODB_URI=''
//   - SQLITE_PATH dédié pour les tests, pas dev.db
//   - ADMIN_EMAIL/PASSWORD posés explicitement → ensureAdmin crée le compte E2E
//   - RATE_LIMIT_MAX élevé pour éviter le throttling
//   - JWT_SECRET fixe pour reproductibilité, MFA_ENCRYPTION_KEY 64×0

const E2E_DB_PATH = path.join(__dirname, '.tmp', 'e2e.db');

const SERVER_ENV = {
  NODE_ENV: 'test',
  MONGODB_URI: '',                       // force SQLite (override le .env du server)
  SQLITE_PATH: E2E_DB_PATH,
  MFA_ENCRYPTION_KEY: '0'.repeat(64),
  JWT_SECRET: 'e2e-secret-not-for-prod-deadbeef-deadbeef-deadbeef-deadbeef',
  RATE_LIMIT_MAX: '1000',
  ADMIN_EMAIL: 'e2e-admin@test.local',
  ADMIN_PASSWORD: 'e2eAdminPass123',
  MFA_BYPASS_DEV: '',                    // override : on veut tester le vrai flow 2FA en E2E
  MOCK_ANTHROPIC: '1',                   // bypass API Anthropic (renvoie une réponse mock fixe)
  PORT: '3001',
  CLIENT_URL: 'http://localhost:5173',
  SERVER_URL: 'http://localhost:3001',
};

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
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

  // Deux webServers indépendants → Playwright attend les DEUX avant les tests.
  // reuseExistingServer permet le dev local (yarn dev déjà en cours).
  webServer: process.env.E2E_BASE_URL ? undefined : [
    {
      command: 'yarn --cwd ../server dev',
      url: 'http://localhost:3001/api/auth/config',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: SERVER_ENV,
    },
    {
      command: 'yarn --cwd ../client dev',
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

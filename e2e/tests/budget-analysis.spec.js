// @ts-check
const { test, expect } = require('@playwright/test');

const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'e2e-admin@test.local',
  password: process.env.ADMIN_PASSWORD || 'e2eAdminPass123',
};

const emailField = (page) => page.getByRole('textbox', { name: 'Adresse email' });
const passwordField = (page) => page.getByRole('textbox', { name: 'Mot de passe' });

async function login(page) {
  await page.goto('/login');
  await emailField(page).fill(ADMIN.email);
  await passwordField(page).fill(ADMIN.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

test.describe('Analyse budgétaire IA', () => {
  test('Page /analysis : header et bouton "Analyser ce mois" visibles', async ({ page }) => {
    await login(page);
    await page.goto('/analysis');

    await expect(page.getByRole('heading', { name: /Analyse budgétaire IA/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyser ce mois/i })).toBeVisible();
  });

  test('Clic sur "Analyser ce mois" rend la synthèse mock', async ({ page }) => {
    await login(page);
    await page.goto('/analysis');

    await page.getByRole('button', { name: /Analyser ce mois/i }).click();

    // Le mock renvoie un summary contenant "MOCK_ANTHROPIC".
    await expect(page.getByText(/MOCK_ANTHROPIC/i)).toBeVisible({ timeout: 10_000 });

    // Le bouton bascule en "Régénérer" une fois l'analyse rendue.
    await expect(page.getByRole('button', { name: /Régénérer/i })).toBeVisible();
  });
});

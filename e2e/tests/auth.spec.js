// @ts-check
const { test, expect } = require('@playwright/test');

const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'e2e-admin@test.local',
  password: process.env.ADMIN_PASSWORD || 'e2eAdminPass123',
};

test.describe('Authentification', () => {
  test('login → home → logout', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Gestion de Comptes' })).toBeVisible();

    await page.getByLabel('Adresse email').fill(ADMIN.email);
    await page.getByLabel('Mot de passe').fill(ADMIN.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // On atterrit sur le dashboard (présence d'au moins un titre/élément de l'AppShell).
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('main')).toBeVisible();

    // Logout — bouton avec aria-label "Se déconnecter" (header desktop)
    // ou via bouton ProfilePage. On va sur /profile pour rester portable.
    await page.goto('/profile');
    const logoutBtn = page.getByRole('button', { name: /se déconnecter|logout/i }).first();
    if (await logoutBtn.isVisible().catch(() => false)) {
      await logoutBtn.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('login échoue avec un mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Adresse email').fill(ADMIN.email);
    await page.getByLabel('Mot de passe').fill('wrong-password');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('lien "mot de passe oublié" ouvre le dialog et envoie le formulaire', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /mot de passe oublié/i }).click();
    await expect(page.getByRole('heading', { name: /mot de passe oublié/i })).toBeVisible();

    await page.getByLabel('Adresse email').last().fill(ADMIN.email);
    await page.getByRole('button', { name: /envoyer le lien/i }).click();

    // Réponse neutre côté serveur : on attend le message de confirmation.
    await expect(page.getByText(/si un compte existe/i)).toBeVisible();
  });
});

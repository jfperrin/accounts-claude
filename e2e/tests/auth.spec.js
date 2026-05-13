// @ts-check
const { test, expect } = require('@playwright/test');

const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'e2e-admin@test.local',
  password: process.env.ADMIN_PASSWORD || 'e2eAdminPass123',
};

// Sélecteurs robustes : on cible le rôle exact (`textbox`, `button`) plutôt que
// le label seul — sinon le toggle "Afficher le mot de passe" entre en collision
// avec le champ "Mot de passe" en strict mode.
const emailField = (page) => page.getByRole('textbox', { name: 'Adresse email' });
const passwordField = (page) => page.getByRole('textbox', { name: 'Mot de passe' });

test.describe('Authentification', () => {
  test('login → home → logout', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Gestion de Comptes' })).toBeVisible();

    await emailField(page).fill(ADMIN.email);
    await passwordField(page).fill(ADMIN.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();

    // Le bouton de soumission disparaît après login OK (la page change pour
    // /). On wait sur l'URL plutôt que sur le main pour éviter le flake.
    await page.waitForURL((url) => url.pathname === '/');
    await expect(page.getByRole('main')).toBeVisible();

    // Logout — bouton "Déconnexion" du header (banner), pas celui de
    // ProfilePage (les deux portent le même nom).
    await page.getByRole('banner').getByRole('button', { name: /déconnex/i }).click();
    await page.waitForURL(/\/login/);
  });

  test('login échoue avec un mauvais mot de passe', async ({ page }) => {
    await page.goto('/login');

    await emailField(page).fill(ADMIN.email);
    await passwordField(page).fill('wrong-password');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('lien "mot de passe oublié" ouvre le dialog et envoie le formulaire', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: /mot de passe oublié/i }).click();
    const dialog = page.getByRole('dialog', { name: /mot de passe oublié/i });
    await expect(dialog).toBeVisible();

    // Dans le dialog : un seul champ "Adresse email" → on scope au dialog.
    await dialog.getByRole('textbox', { name: 'Adresse email' }).fill(ADMIN.email);
    await page.getByRole('button', { name: /envoyer le lien/i }).click();

    // Réponse neutre côté serveur : on attend le message de confirmation.
    await expect(page.getByText(/si un compte existe/i)).toBeVisible();
  });
});

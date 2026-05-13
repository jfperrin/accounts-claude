const bcrypt = require('bcryptjs');

// Seed un compte de test (non-admin) au boot pour permettre les sessions
// Playwright manuelles depuis le harness Claude ou tout autre client externe,
// sans exposer le mot de passe du compte admin ni polluer les données réelles.
//
// Garde-fous :
//   - Ne s'exécute QUE si NODE_ENV !== 'production' (jamais en prod)
//   - Désactivable explicitement via DEV_USER_DISABLED=1
//   - Email/password configurables via DEV_USER_EMAIL / DEV_USER_PASSWORD
//
// Cloisonnement : chaque entité (Bank/Operation/Category/...) est scopée par
// userId, donc les données créées sous ce compte n'apparaissent jamais sous le
// compte admin ni sous un autre compte humain.
//
// Idempotent : peut être appelé à chaque démarrage sans effet de bord.

const DEFAULT_EMAIL = 'claude-dev@test.local';
const DEFAULT_PASSWORD = 'claudeDev!2026';

module.exports = async function ensureDevUser(db) {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.DEV_USER_DISABLED === '1') return;

  const email = process.env.DEV_USER_EMAIL || DEFAULT_EMAIL;
  const password = process.env.DEV_USER_PASSWORD || DEFAULT_PASSWORD;

  const existing = await db.users.findByEmail(email);
  if (existing) {
    if (!existing.emailVerified) {
      await db.users.setEmailVerified(existing._id ?? existing.id);
    }
    console.log(`[dev-user] Compte de test "${email}" prêt.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.users.create({
    email,
    passwordHash,
    role: 'user',
    emailVerified: true,
  });
  console.log(`[dev-user] Compte de test "${email}" créé.`);
};

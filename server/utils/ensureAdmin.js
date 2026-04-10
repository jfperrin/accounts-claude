const bcrypt = require('bcryptjs');

// Crée ou met à jour le compte admin si les variables d'environnement sont définies.
// Idempotent : peut être appelé à chaque démarrage sans effet de bord.
module.exports = async function ensureAdmin(db) {
  const { ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
  if (!ADMIN_PASSWORD || !ADMIN_EMAIL) return;

  const existing = await db.users.findByEmail(ADMIN_EMAIL);
  if (existing) {
    if (existing.role !== 'admin') {
      await db.users.updateByAdmin(existing._id, {
        email: existing.email,
        role: 'admin',
      });
    }
    console.log(`[admin] Compte admin "${ADMIN_EMAIL}" prêt.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.users.create({
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
  });
  console.log(`[admin] Compte admin "${ADMIN_EMAIL}" créé.`);
};

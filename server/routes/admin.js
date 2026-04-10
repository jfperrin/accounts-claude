// Routes de gestion des utilisateurs — accès admin uniquement.
// Préfixe : /api/admin
// Protégées par requireAuth + requireAdmin dans app.js.

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const wrap = require('../utils/asyncHandler');
const { sendPasswordResetEmail } = require('../utils/mailer');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Sérialise un user pour la liste admin (pas de passwordHash)
function serializeAdminUser(u) {
  return {
    _id:       u._id ?? u.id,
    email:     u.email ?? null,
    role:      u.role ?? 'user',
    firstName: u.firstName ?? null,
    lastName:  u.lastName ?? null,
    nickname:  u.nickname ?? null,
    createdAt: u.createdAt ?? null,
  };
}

// GET /api/admin/users — liste tous les utilisateurs
router.get('/users', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const users = await db.users.findAll();
  res.json(users.map(serializeAdminUser));
}));

// POST /api/admin/users — crée un utilisateur
router.post('/users', wrap(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email et password sont requis' });
  }
  const effectiveRole = role ?? 'user';
  if (!['user', 'admin'].includes(effectiveRole)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const db = req.app.locals.db;
  if (await db.users.emailExists(email)) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email, passwordHash, role: effectiveRole });
  res.status(201).json(serializeAdminUser(user));
}));

// PUT /api/admin/users/:id — modifie email, role
router.put('/users/:id', wrap(async (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'email est requis' });
  }
  const effectiveRole = role ?? 'user';
  if (!['user', 'admin'].includes(effectiveRole)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const selfId = String(req.user._id ?? req.user.id);
  if (selfId === req.params.id && effectiveRole !== 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier votre propre rôle' });
  }
  const db = req.app.locals.db;
  try {
    const updated = await db.users.updateByAdmin(req.params.id, { email, role: effectiveRole });
    if (!updated) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(serializeAdminUser(updated));
  } catch (err) {
    if (err.code === 11000 || err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Email déjà utilisé' });
    }
    throw err;
  }
}));

// DELETE /api/admin/users/:id — supprime user + toutes ses données en cascade
router.delete('/users/:id', wrap(async (req, res) => {
  const selfId = String(req.user._id ?? req.user.id);
  if (selfId === req.params.id) {
    return res.status(400).json({ message: 'Impossible de supprimer votre propre compte' });
  }
  const db = req.app.locals.db;
  const targetId = req.params.id;
  // Cascade : operations → periods → recurringOps → banks → resetTokens → user
  const periods = await db.periods.findByUser(targetId);
  for (const p of periods) {
    await db.operations.deleteByPeriod(p._id, targetId);
  }
  await db.periods.deleteByUser(targetId);
  await db.recurringOps.deleteByUser(targetId);
  await db.banks.deleteByUser(targetId);
  await db.resetTokens.deleteByUser(targetId);
  await db.users.deleteUser(targetId);
  res.json({ message: 'Utilisateur supprimé' });
}));

// POST /api/admin/users/:id/reset-password — envoie un email de reset
router.post('/users/:id/reset-password', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  if (!user.email) return res.status(400).json({ message: "L'utilisateur n'a pas d'email" });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h
  await db.resetTokens.create(user._id ?? user.id, token, expiresAt);

  const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  res.json({ message: 'Email de réinitialisation envoyé' });
}));

module.exports = router;

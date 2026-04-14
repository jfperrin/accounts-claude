// Routes d'authentification — les seules accessibles sans session active.
// Préfixe : /api/auth

const router = require('express').Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const wrap = require('../utils/asyncHandler');
const requireAuth = require('../middleware/requireAuth');
const upload = require('../middleware/upload');
const { randomUUID } = require('crypto');
const mailer = require('../utils/mailer');

// Helper : sérialise un user Mongoose ou SQLite en réponse JSON uniforme
function serializeUser(u) {
  return {
    _id:           u._id ?? u.id,
    email:         u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    role:          u.role ?? 'user',
    title:         u.title     ?? null,
    firstName:     u.firstName ?? null,
    lastName:      u.lastName  ?? null,
    nickname:      u.nickname  ?? null,
    avatarUrl:     u.avatarUrl ?? null,
  };
}

const ALLOWED_DAYS = [1, 30, 365];
const parseCookies = require('cookie').parse;

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
// URL de base pour les liens dans les emails : cible le serveur directement.
// En prod sur le même domaine : identique à CLIENT_URL. Si l'API est sur un sous-domaine,
// utiliser SERVER_URL pour garantir l'accessibilité des liens.
const SERVER_URL = process.env.SERVER_URL || CLIENT_URL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '20', 10) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans 15 minutes' },
});

// POST /api/auth/register
// Crée un compte local. Envoie un email de vérification.
// Ne crée pas de session — l'utilisateur doit valider son email avant de se connecter.
router.post('/register', authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !EMAIL_RE.test(email) || !password) return res.status(400).json({ message: 'Champs requis' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  if (await db.users.emailExists(normalizedEmail)) return res.status(409).json({ message: 'Email déjà utilisé' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email: normalizedEmail, passwordHash });
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.resetTokens.create(user._id, token, expiresAt, { type: 'email_verify' });
  const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(normalizedEmail, verifyUrl);
  res.status(201).json({ message: 'Vérifiez votre email pour activer votre compte' });
}));

// POST /api/auth/login
// Délègue à Passport LocalStrategy. Bloque les comptes locaux non-vérifiés.
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    if (!user.googleId && !user.emailVerified) {
      // Renvoie automatiquement un email de vérification à chaque tentative de connexion bloquée
      try {
        const db = req.app.locals.db;
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'email_verify' });
        const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
        await mailer.sendVerificationEmail(user.email, verifyUrl);
      } catch (_) { /* ne pas bloquer la réponse 403 si l'envoi échoue */ }
      return res.status(403).json({ message: 'Email non vérifié. Un lien de vérification vous a été envoyé.' });
    }
    const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
      ? Number(req.body.rememberDays)
      : 30;
    req.login(user, async (err) => {
      if (err) return next(err);
      try {
        const db = req.app.locals.db;
        const rememberToken = randomUUID();
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await db.resetTokens.create(user._id ?? user.id, rememberToken, expiresAt, { type: 'remember_me' });
        res.cookie('remember_me', rememberToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: days * 24 * 60 * 60 * 1000,
        });
      } catch (_) { /* ne pas bloquer la connexion si la création du token échoue */ }
      res.json(serializeUser(user));
    });
  })(req, res, next);
});

// GET /api/auth/config
// Indique au client si la connexion Google est disponible (clés configurées).
// Le client l'utilise pour afficher ou cacher le bouton "Continuer avec Google".
router.get('/config', (_req, res) => {
  res.json({ googleEnabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

// GET /api/auth/google → redirige vers la page de consentement Google
// GET /api/auth/google/callback → Google rappelle ici après acceptation
// En cas d'échec, Google redirige vers /login?error=google côté client.
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.redirect(`${CLIENT_URL}/login?error=google`);
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=google` }),
  (_req, res) => res.redirect(CLIENT_URL),
);

// POST /api/auth/logout
// Invalide le token remember_me en base, efface le cookie, détruit la session.
router.post('/logout', wrap(async (req, res) => {
  const token = parseCookies(req.headers.cookie || '').remember_me;
  if (token) {
    try { await req.app.locals.db.resetTokens.markUsed(token); } catch (_) {}
  }
  res.clearCookie('remember_me', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  req.logout(() => res.json({ message: 'Déconnecté' }));
}));

// GET /api/auth/me
// Utilisé par AuthContext au montage du client pour savoir si une session existe.
// Retourne 401 si non authentifié (le client affiche alors la page de login).
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: 'Non authentifié' });
  res.json(serializeUser(req.user));
});

// PUT /api/auth/profile — met à jour les champs de profil de l'utilisateur connecté
router.put('/profile', requireAuth, wrap(async (req, res) => {
  const { title, firstName, lastName, nickname } = req.body;
  const db = req.app.locals.db;
  const updated = await db.users.updateProfile(req.user._id, { title, firstName, lastName, nickname });
  res.json(serializeUser(updated));
}));

// PUT /api/auth/email — demande un changement d'email
// Ne modifie pas l'email immédiatement : envoie un lien au nouvel email.
// L'email en base est mis à jour uniquement après clic sur le lien (GET /verify-email/:token).
router.put('/email', requireAuth, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Email invalide' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  const selfId = String(req.user._id ?? req.user.id);
  const existing = await db.users.findByEmail(normalizedEmail);
  if (existing && String(existing._id ?? existing.id) !== selfId) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.resetTokens.create(req.user._id ?? req.user.id, token, expiresAt, {
    type: 'email_change',
    pendingEmail: normalizedEmail,
  });
  const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
  await mailer.sendEmailChangeEmail(normalizedEmail, verifyUrl);
  res.json({ message: `Un lien de confirmation a été envoyé à ${normalizedEmail}` });
}));

// POST /api/auth/avatar — upload de l'avatar (multipart/form-data, champ "avatar")
// Le fichier est stocké en mémoire puis converti en data URL Base64 persistée en base.
router.post('/avatar', requireAuth, upload.single('avatar'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });
  // Dev (disk storage) : chemin statique — Prod (memory storage) : data URL Base64
  const avatarUrl = req.file.buffer
    ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    : `/uploads/avatars/${req.file.filename}`;
  const db = req.app.locals.db;
  const updated = await db.users.updateAvatar(req.user._id, avatarUrl);
  res.json(serializeUser(updated));
}));

// GET /api/auth/verify-email/:token
// Valide un token de type email_verify ou email_change.
// email_verify → active le compte (emailVerified = true)
// email_change → applique pendingEmail comme nouvel email
// Redirige vers /login?verified=1 en cas de succès.
router.get('/verify-email/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record || !['email_verify', 'email_change'].includes(record.type)) {
    return res.redirect(`${CLIENT_URL}/login?error=token_expired`);
  }
  if (record.type === 'email_change') {
    const existing = await db.users.findByEmail(record.pendingEmail);
    if (existing && String(existing._id ?? existing.id) !== String(record.userId)) {
      await db.resetTokens.markUsed(record.token);
      return res.redirect(`${CLIENT_URL}/login?error=email_taken`);
    }
    try {
      await db.users.applyPendingEmail(record.userId, record.pendingEmail);
    } catch (err) {
      if (err.code === 11000) {
        await db.resetTokens.markUsed(record.token);
        return res.redirect(`${CLIENT_URL}/login?error=email_taken`);
      }
      throw err;
    }
  } else {
    await db.users.setEmailVerified(record.userId);
  }
  await db.resetTokens.markUsed(record.token);
  res.redirect(`${CLIENT_URL}/login?verified=1`);
}));

// POST /api/auth/resend-verification
// Accessible sans session (utilisateur bloqué au login faute de vérification).
// Authentifié → utilise req.user. Non authentifié → attend { email } dans le body.
// Répond toujours 200 pour éviter l'énumération d'adresses.
router.post('/resend-verification', authLimiter, wrap(async (req, res) => {
  const neutral = { message: 'Email de vérification envoyé' };
  const db = req.app.locals.db;

  let user;
  if (req.isAuthenticated()) {
    user = req.user;
  } else {
    const { email } = req.body;
    if (!email) return res.json(neutral);
    user = await db.users.findByEmail(email.trim().toLowerCase());
  }

  if (!user || user.emailVerified || user.googleId) return res.json(neutral);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'email_verify' });
  const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(user.email, verifyUrl);
  res.json(neutral);
}));

// GET /api/auth/reset-password/:token — vérifie la validité du token
router.get('/reset-password/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record) return res.status(410).json({ message: 'Lien invalide ou expiré' });
  res.json({ valid: true });
}));

// POST /api/auth/reset-password/:token — applique le nouveau mot de passe
router.post('/reset-password/:token', wrap(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record) return res.status(410).json({ message: 'Lien invalide ou expiré' });

  const passwordHash = await bcrypt.hash(password, 12);
  await db.users.setPassword(record.userId, passwordHash);
  await db.resetTokens.markUsed(req.params.token);

  res.json({ message: 'Mot de passe mis à jour' });
}));

// PUT /api/auth/password — change le mot de passe de l'utilisateur connecté
// Vérifie le mot de passe actuel, enregistre le nouveau, envoie un email avec lien d'annulation.
router.put('/password', requireAuth, authLimiter, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const db = req.app.locals.db;
  const userWithHash = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  if (!userWithHash.passwordHash) {
    return res.status(400).json({ message: 'Compte Google, changement de mot de passe non disponible' });
  }
  const valid = await bcrypt.compare(currentPassword ?? '', userWithHash.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

  const oldPasswordHash = userWithHash.passwordHash;
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.users.setPassword(req.user._id ?? req.user.id, newHash);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h
  await db.resetTokens.create(req.user._id ?? req.user.id, token, expiresAt, {
    type: 'password_change_cancel',
    oldPasswordHash,
  });
  const cancelUrl = `${SERVER_URL}/api/auth/cancel-password-change/${token}`;
  await mailer.sendPasswordChangeEmail(req.user.email, cancelUrl);
  res.json({ message: 'Mot de passe mis à jour' });
}));

// GET /api/auth/cancel-password-change/:token — annule un changement de mot de passe
// Restaure l'ancien hash, invalide le token, redirige vers /login?password_cancelled=1.
router.get('/cancel-password-change/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record || record.type !== 'password_change_cancel') {
    return res.redirect(`${CLIENT_URL}/login?error=token_expired`);
  }
  await db.users.setPassword(record.userId, record.oldPasswordHash);
  await db.resetTokens.markUsed(record.token);
  res.redirect(`${CLIENT_URL}/login?password_cancelled=1`);
}));

module.exports = router;

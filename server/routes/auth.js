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

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 tentatives par IP par fenêtre
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
  const verifyUrl = `${CLIENT_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(normalizedEmail, verifyUrl);
  res.status(201).json({ message: 'Vérifiez votre email pour activer votre compte' });
}));

// POST /api/auth/login
// Délègue à Passport LocalStrategy. Bloque les comptes locaux non-vérifiés.
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    if (!user.googleId && !user.emailVerified) {
      return res.status(403).json({ message: 'Email non vérifié. Consultez votre boîte mail.' });
    }
    req.login(user, (err) => {
      if (err) return next(err);
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
// req.logout() (Passport) détruit la session côté serveur.
router.post('/logout', (req, res) => {
  req.logout(() => res.json({ message: 'Déconnecté' }));
});

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

// PUT /api/auth/email — change l'email de l'utilisateur connecté
router.put('/email', requireAuth, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Email invalide' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  const selfId = String(req.user._id ?? req.user.id);
  // Vérifier le doublon uniquement sur les autres utilisateurs
  const existing = await db.users.findByEmail(normalizedEmail);
  if (existing && String(existing._id ?? existing.id) !== selfId) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  const updated = await db.users.updateEmail(selfId, normalizedEmail);
  res.json(serializeUser(updated));
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

module.exports = router;

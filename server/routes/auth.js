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
const { router: mfaRouter, helpers: mfaHelpers } = require('./mfa');
const {
  signMfaChallenge,
  verifyTrustedDevice,
  trustFingerprint,
  hashRefreshToken,
  generateRefreshToken,
  signAccessToken,
  authCookieOptions,
  ACCESS_TTL_SEC,
  MFA_CHALLENGE_TTL_SEC,
  TRUSTED_DEVICE_COOKIE,
} = require('../utils/tokens');
const { issueAuthCookies, clearAuthCookies, REFRESH_COOKIE_PATH } = require('../utils/issueAuth');

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
    acceptedToSAt: u.acceptedToSAt ?? null,
    totpEnabled:     !!u.totpEnabled,
    emailMfaEnabled: !!u.emailMfaEnabled,
    recoveryCodesRemaining: (u.recoveryCodes || []).length,
  };
}

const ALLOWED_DAYS = [1, 30, 365];

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
  const { email, password, acceptedToS } = req.body;
  if (!email || !EMAIL_RE.test(email) || !password) return res.status(400).json({ message: 'Champs requis' });
  if (!acceptedToS) return res.status(400).json({ message: 'Vous devez accepter les conditions générales d\'utilisation' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  if (await db.users.emailExists(normalizedEmail)) return res.status(409).json({ message: 'Email déjà utilisé' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email: normalizedEmail, passwordHash, acceptedToSAt: new Date() });
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.resetTokens.create(user._id, token, expiresAt, { type: 'email_verify' });
  const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(normalizedEmail, verifyUrl);
  res.status(201).json({ message: 'Vérifiez votre email pour activer votre compte' });
}));

// POST /api/auth/login
// LocalStrategy (passport) avec { session: false } : on vérifie le password
// puis on émet soit les cookies d'auth (access+refresh) soit un cookie
// mfa_challenge (JWT 10min) qui porte l'état du flow 2FA.
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    if (!user.googleId && !user.emailVerified) {
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

    // Bypass MFA : explicite (MFA_BYPASS_DEV=1) ou auto en dev local
    // (NODE_ENV=development). NODE_ENV=test (vitest, e2e) et production
    // gardent le flow 2FA réel.
    const bypassMfa = process.env.MFA_BYPASS_DEV === '1'
      || process.env.NODE_ENV === 'development';
    const hasMfa = !bypassMfa && !user.googleId && (user.totpEnabled || user.emailMfaEnabled);
    if (hasMfa) {
      // Trusted device : si le navigateur a passé un challenge MFA récent
      // (cookie toujours valide ET fingerprint MFA/password inchangé), on saute
      // le challenge. Le cookie a été émis lors du /mfa/challenge/verify avec
      // TTL = rememberDays choisi à ce moment-là.
      const trustedToken = req.cookies?.[TRUSTED_DEVICE_COOKIE];
      if (trustedToken) {
        const trusted = verifyTrustedDevice(trustedToken);
        if (trusted
            && trusted.sub === String(user._id ?? user.id)
            && trusted.fp === trustFingerprint(user)) {
          await issueAuthCookies(req, res, user, { rememberDays: days });
          return res.json(serializeUser(user));
        }
      }

      if (mfaHelpers.isMfaLocked(user)) {
        return res.status(423).json({
          message: 'Trop de tentatives, compte temporairement verrouillé',
          lockedUntil: user.mfaLockedUntil,
        });
      }
      const methods = [];
      if (user.totpEnabled) methods.push('totp');
      if (user.emailMfaEnabled) methods.push('email');
      const challenge = signMfaChallenge({
        userId: user._id ?? user.id,
        methods,
        rememberDays: days,
      });
      res.cookie('mfa_challenge', challenge, authCookieOptions({
        maxAgeMs: MFA_CHALLENGE_TTL_SEC * 1000,
        path: '/api/auth',
      }));
      return res.json({ mfaRequired: true, methods });
    }

    await issueAuthCookies(req, res, user, { rememberDays: days });
    res.json(serializeUser(user));
  })(req, res, next);
});

// POST /api/auth/refresh
// Vérifie le cookie refresh_token, fait tourner le hash en DB et émet de
// nouveaux cookies (rotation). Si invalide/expiré/révoqué → 401.
router.post('/refresh', wrap(async (req, res) => {
  const raw = req.cookies?.refresh_token;
  if (!raw) return res.status(401).json({ message: 'Pas de refresh token' });
  const db = req.app.locals.db;
  const hash = hashRefreshToken(raw);
  const record = await db.refreshTokens.findByHash(hash);
  if (!record) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Refresh token invalide' });
  }
  const user = await db.users.findById(record.userId);
  if (!user) {
    clearAuthCookies(res);
    return res.status(401).json({ message: 'Utilisateur introuvable' });
  }

  // Rotation : nouveau token brut, on remplace le hash en DB et on refresh la
  // date d'expiration sur la même TTL que celle d'origine (calculée depuis createdAt).
  const ttl = record.expiresAt.getTime() - record.createdAt.getTime();
  const { raw: newRaw, hash: newHash } = generateRefreshToken();
  const newExpiresAt = new Date(Date.now() + ttl);
  await db.refreshTokens.touchAndRotate(record._id, newHash, newExpiresAt);

  const access = signAccessToken(user);
  res.cookie('access_token', access, authCookieOptions({ maxAgeMs: ACCESS_TTL_SEC * 1000 }));
  res.cookie('refresh_token', newRaw, authCookieOptions({
    maxAgeMs: ttl,
    path: REFRESH_COOKIE_PATH,
  }));
  res.json(serializeUser(user));
}));

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
}, passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login?error=google`, session: false }),
  wrap(async (req, res) => {
    if (!req.user) return res.redirect(`${CLIENT_URL}/login?error=google`);
    await issueAuthCookies(req, res, req.user, { rememberDays: 30 });
    res.redirect(CLIENT_URL);
  }),
);

// POST /api/auth/logout
// Révoque le refresh token courant en DB puis efface tous les cookies d'auth.
router.post('/logout', wrap(async (req, res) => {
  const raw = req.cookies?.refresh_token;
  if (raw) {
    const db = req.app.locals.db;
    const record = await db.refreshTokens.findByHash(hashRefreshToken(raw));
    if (record) await db.refreshTokens.revokeById(record._id, record.userId);
  }
  clearAuthCookies(res);
  res.clearCookie('mfa_challenge', authCookieOptions({ path: '/api/auth' }));
  res.json({ message: 'Déconnecté' });
}));

// GET /api/auth/me
// Avec JWT, l'absence d'access valide retourne 401 — le client tente alors un
// /refresh avant de basculer en mode déconnecté.
router.get('/me', requireAuth, (req, res) => {
  res.json(serializeUser(req.user));
});

// GET /api/auth/sessions — liste les sessions actives de l'utilisateur courant.
// Marque la session courante via `current: true` pour que le client puisse l'exclure
// d'un "Déconnecter ailleurs".
router.get('/sessions', requireAuth, wrap(async (req, res) => {
  const db = req.app.locals.db;
  const records = await db.refreshTokens.findActive(req.user._id ?? req.user.id);
  const currentHash = req.cookies?.refresh_token ? hashRefreshToken(req.cookies.refresh_token) : null;
  res.json(records.map((r) => ({
    _id: String(r._id ?? r.id),
    userAgent: r.userAgent,
    ip: r.ip,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    current: !!currentHash && r.tokenHash === currentHash,
  })));
}));

router.delete('/sessions/:id', requireAuth, wrap(async (req, res) => {
  const db = req.app.locals.db;
  await db.refreshTokens.revokeById(req.params.id, req.user._id ?? req.user.id);
  res.json({ message: 'Session révoquée' });
}));

router.post('/sessions/revoke-others', requireAuth, wrap(async (req, res) => {
  const raw = req.cookies?.refresh_token;
  const db = req.app.locals.db;
  let exceptId = null;
  if (raw) {
    const current = await db.refreshTokens.findByHash(hashRefreshToken(raw));
    exceptId = current?._id ?? null;
  }
  if (exceptId) {
    await db.refreshTokens.revokeOthers(req.user._id ?? req.user.id, exceptId);
  } else {
    await db.refreshTokens.revokeAll(req.user._id ?? req.user.id);
  }
  res.json({ message: 'Autres sessions révoquées' });
}));

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
    const { email } = req.body ?? {};
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

// POST /api/auth/forgot-password
// Déclenche l'envoi d'un lien de réinitialisation. Répond toujours 200 avec un
// message neutre pour éviter l'énumération d'adresses (un attaquant ne peut pas
// déduire l'existence d'un compte à partir d'un succès/échec).
// Les comptes Google (sans passwordHash) sont ignorés silencieusement : aucun
// reset possible, ils doivent passer par Google.
router.post('/forgot-password', authLimiter, wrap(async (req, res) => {
  const neutral = { message: 'Si un compte existe pour cette adresse, un email a été envoyé.' };
  const { email } = req.body ?? {};
  if (!email || !EMAIL_RE.test(email)) return res.json(neutral);
  const db = req.app.locals.db;
  const user = await db.users.findByEmail(email.trim().toLowerCase());
  if (!user || !user.passwordHash) return res.json(neutral);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'password_reset' });
  const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
  await mailer.sendPasswordResetEmail(user.email, resetUrl);
  res.json(neutral);
}));

// GET /api/auth/reset-password/:token — vérifie la validité du token
router.get('/reset-password/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record || record.type !== 'password_reset') {
    return res.status(410).json({ message: 'Lien invalide ou expiré' });
  }
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
  // Verrouille à 'password_reset' uniquement : un token email_verify ou
  // password_change_cancel ne doit jamais pouvoir servir à fixer un nouveau pwd.
  if (!record || record.type !== 'password_reset') {
    return res.status(410).json({ message: 'Lien invalide ou expiré' });
  }

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

router.use('/mfa', mfaRouter);

module.exports = router;

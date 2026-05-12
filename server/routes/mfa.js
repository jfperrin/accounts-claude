// Routes 2FA — préfixe /api/auth/mfa
// Montées depuis routes/auth.js après authLimiter.

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { generateSecret: totpGenerateSecret, generateSync: totpGenerate, verifySync: totpVerify, generateURI: totpURI } = require('otplib');
const QRCode = require('qrcode');
const wrap = require('../utils/asyncHandler');
const requireAuth = require('../middleware/requireAuth');
const cryptoBox = require('../utils/cryptoBox');
const { generateEmailCode, generateRecoveryCodes } = require('../utils/mfaCodes');
const mailer = require('../utils/mailer');

const MFA_ISSUER = process.env.MFA_ISSUER || 'Comptes';
const CODE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;

// Récupère le challenge depuis la session. Retourne null si absent, expiré,
// ou trop d'échecs. Dans ce dernier cas, le challenge est purgé de la session.
function getValidChallenge(req) {
  const ch = req.session?.mfaChallenge;
  if (!ch) return null;
  if (Date.now() - ch.createdAt > CHALLENGE_TTL_MS) {
    delete req.session.mfaChallenge;
    return null;
  }
  if (ch.failedAttempts >= MAX_CHALLENGE_ATTEMPTS) {
    delete req.session.mfaChallenge;
    return null;
  }
  return ch;
}

// Rate limiter Express générique sur les routes MFA (30 req / 15min par IP).
// Le rate-limit fin par user (1/60s sur send-email) est géré au cas par cas
// via db.mfaCodes.countRecent dans chaque handler concerné.
// En test (RATE_LIMIT_MAX élevé), on aligne le max pour ne pas bloquer la suite.
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10) || 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(mfaLimiter);

// Helpers ────────────────────────────────────────────────────────────────────

// passwordHash est absent de req.user (exclu par findById via select('-passwordHash')).
// On détecte un compte Google uniquement via googleId.
function isLocalAccount(user) {
  return !user.googleId;
}

async function rejectIfGoogle(req, res) {
  if (!isLocalAccount(req.user)) {
    res.status(400).json({ message: '2FA non disponible pour les comptes Google' });
    return true;
  }
  return false;
}

// Génère un code 6 chiffres, le hash, l'insère, renvoie le code en clair pour envoi.
async function issueEmailCode(db, userId, purpose) {
  const code = generateEmailCode();
  const codeHash = await bcrypt.hash(code, 10);
  await db.mfaCodes.create({
    userId, codeHash, purpose,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

// Vérifie un code email. Marque le record `used` quoi qu'il arrive (un code = un essai).
async function verifyEmailCode(db, userId, purpose, code) {
  const record = await db.mfaCodes.findLatestValid({ userId, purpose });
  if (!record) return false;
  await db.mfaCodes.markUsed(record._id);
  return bcrypt.compare(code, record.codeHash);
}

function verifyTotpCode(user, code) {
  if (!user.totpEnabled || !user.totpSecret) return false;
  try {
    const secret = cryptoBox.decrypt(user.totpSecret);
    return totpVerify({ secret, token: code }).valid;
  } catch (_) {
    return false;
  }
}

// Vérifie + consomme un recovery code. Retourne true et retire le hash utilisé.
async function consumeRecoveryCode(db, user, code) {
  for (const hash of user.recoveryCodes || []) {
    if (await bcrypt.compare(code, hash)) {
      const remaining = user.recoveryCodes.filter((h) => h !== hash);
      await db.users.updateMfa(user._id, { recoveryCodes: remaining });
      return true;
    }
  }
  return false;
}

// POST /mfa/totp/setup
// Génère un secret TOTP, le stocke chiffré (totpEnabled reste false jusqu'à
// confirmation par /enable), renvoie le QR code et le secret pour saisie manuelle.
router.post('/totp/setup', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const db = req.app.locals.db;
  const secret = totpGenerateSecret();
  const encrypted = cryptoBox.encrypt(secret);
  await db.users.updateMfa(req.user._id ?? req.user.id, {
    totpSecret: encrypted,
    totpEnabled: false,
  });
  const otpauthUrl = totpURI({ label: req.user.email, issuer: MFA_ISSUER, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  res.json({ secret, otpauthUrl, qrCodeDataUrl });
}));

// POST /mfa/totp/enable
// Vérifie un code TOTP initial, active totpEnabled, génère 10 recovery codes (renvoyés en clair une seule fois).
router.post('/totp/enable', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ message: 'Code requis' });
  const db = req.app.locals.db;
  const full = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  if (!full.totpSecret) return res.status(400).json({ message: 'Aucun setup TOTP en attente' });
  const secret = cryptoBox.decrypt(full.totpSecret);
  if (!totpVerify({ secret, token: code }).valid) {
    return res.status(401).json({ message: 'Code invalide' });
  }
  const recoveryPlain = generateRecoveryCodes();
  const recoveryHashes = await Promise.all(recoveryPlain.map((c) => bcrypt.hash(c, 10)));
  await db.users.updateMfa(full._id, {
    totpEnabled: true,
    recoveryCodes: recoveryHashes,
  });
  res.json({ recoveryCodes: recoveryPlain });
}));

// POST /mfa/totp/disable
// Demande password + code (TOTP, email ou recovery). Purge les recovery codes si plus aucun facteur actif.
router.post('/totp/disable', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const { password, code } = req.body ?? {};
  if (!password || !code) return res.status(400).json({ message: 'Mot de passe et code requis' });
  const db = req.app.locals.db;
  const full = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  const validPwd = await bcrypt.compare(password, full.passwordHash);
  if (!validPwd) return res.status(401).json({ message: 'Mot de passe incorrect' });

  let codeOk = verifyTotpCode(full, code);
  if (!codeOk && full.emailMfaEnabled) {
    codeOk = await verifyEmailCode(db, full._id, 'login', code);
  }
  if (!codeOk) {
    codeOk = await consumeRecoveryCode(db, full, code);
  }
  if (!codeOk) return res.status(401).json({ message: 'Code invalide' });

  const updates = { totpSecret: null, totpEnabled: false };
  if (!full.emailMfaEnabled) updates.recoveryCodes = [];
  await db.users.updateMfa(full._id, updates);
  res.json({ message: 'TOTP désactivé' });
}));

// POST /mfa/email/setup
// Envoie un code de test à l'email de l'utilisateur. Rate-limit 1/60s, 3/15min par user.
router.post('/email/setup', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const db = req.app.locals.db;
  const userId = req.user._id ?? req.user.id;
  const recent60s = await db.mfaCodes.countRecent({ userId, purpose: 'setup', sinceMs: 60_000 });
  if (recent60s > 0) return res.status(429).json({ message: 'Attendez avant de redemander un code' });
  const recent15min = await db.mfaCodes.countRecent({ userId, purpose: 'setup', sinceMs: 15 * 60_000 });
  if (recent15min >= 3) return res.status(429).json({ message: 'Trop de demandes, réessayez plus tard' });
  const code = await issueEmailCode(db, userId, 'setup');
  await mailer.sendMfaCodeEmail(req.user.email, code, 'setup');
  res.json({ message: 'Code envoyé par email' });
}));

// POST /mfa/email/enable
// Confirme un code reçu via /setup et active emailMfaEnabled.
// Si aucun autre facteur n'était actif, génère aussi les recovery codes.
router.post('/email/enable', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ message: 'Code requis' });
  const db = req.app.locals.db;
  const userId = req.user._id ?? req.user.id;
  const ok = await verifyEmailCode(db, userId, 'setup', code);
  if (!ok) return res.status(401).json({ message: 'Code invalide' });

  const full = await db.users.findByIdWithHash(userId);
  const updates = { emailMfaEnabled: true };
  let recoveryPlain;
  if (!full.totpEnabled && (!full.recoveryCodes || full.recoveryCodes.length === 0)) {
    recoveryPlain = generateRecoveryCodes();
    updates.recoveryCodes = await Promise.all(recoveryPlain.map((c) => bcrypt.hash(c, 10)));
  }
  await db.users.updateMfa(userId, updates);
  res.json({ message: 'Email MFA activé', ...(recoveryPlain && { recoveryCodes: recoveryPlain }) });
}));

// POST /mfa/email/disable
router.post('/email/disable', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const { password, code } = req.body ?? {};
  if (!password || !code) return res.status(400).json({ message: 'Mot de passe et code requis' });
  const db = req.app.locals.db;
  const full = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  const validPwd = await bcrypt.compare(password, full.passwordHash);
  if (!validPwd) return res.status(401).json({ message: 'Mot de passe incorrect' });

  let codeOk = verifyTotpCode(full, code);
  if (!codeOk && full.emailMfaEnabled) {
    codeOk = await verifyEmailCode(db, full._id, 'disable', code);
  }
  if (!codeOk) {
    codeOk = await consumeRecoveryCode(db, full, code);
  }
  if (!codeOk) return res.status(401).json({ message: 'Code invalide' });

  const updates = { emailMfaEnabled: false };
  if (!full.totpEnabled) updates.recoveryCodes = [];
  await db.users.updateMfa(full._id, updates);
  res.json({ message: 'Email MFA désactivé' });
}));

// POST /mfa/email/disable/send
// Envoie un code purpose='disable' pour permettre la désactivation via email.
router.post('/email/disable/send', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const db = req.app.locals.db;
  const userId = req.user._id ?? req.user.id;
  const recent60s = await db.mfaCodes.countRecent({ userId, purpose: 'disable', sinceMs: 60_000 });
  if (recent60s > 0) return res.status(429).json({ message: 'Attendez avant de redemander un code' });
  const code = await issueEmailCode(db, userId, 'disable');
  await mailer.sendMfaCodeEmail(req.user.email, code, 'disable');
  res.json({ message: 'Code envoyé par email' });
}));

// POST /mfa/recovery/regenerate
// Demande password + code 2FA actuel. Invalide les anciens, génère 10 nouveaux.
router.post('/recovery/regenerate', requireAuth, wrap(async (req, res) => {
  if (await rejectIfGoogle(req, res)) return;
  const { password, code } = req.body ?? {};
  if (!password || !code) return res.status(400).json({ message: 'Mot de passe et code requis' });
  const db = req.app.locals.db;
  const full = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  if (!full.totpEnabled && !full.emailMfaEnabled) {
    return res.status(400).json({ message: 'Aucun 2FA actif' });
  }
  const validPwd = await bcrypt.compare(password, full.passwordHash);
  if (!validPwd) return res.status(401).json({ message: 'Mot de passe incorrect' });

  let codeOk = verifyTotpCode(full, code);
  if (!codeOk && full.emailMfaEnabled) {
    codeOk = await verifyEmailCode(db, full._id, 'login', code);
  }
  if (!codeOk) return res.status(401).json({ message: 'Code invalide' });

  const plain = generateRecoveryCodes();
  const hashes = await Promise.all(plain.map((c) => bcrypt.hash(c, 10)));
  await db.users.updateMfa(full._id, { recoveryCodes: hashes });
  res.json({ recoveryCodes: plain });
}));

// POST /mfa/challenge/send-email
router.post('/challenge/send-email', wrap(async (req, res) => {
  const ch = getValidChallenge(req);
  if (!ch || !ch.methods.includes('email')) {
    return res.status(401).json({ message: 'Aucun challenge en cours' });
  }
  const db = req.app.locals.db;
  const recent60s = await db.mfaCodes.countRecent({ userId: ch.userId, purpose: 'login', sinceMs: 60_000 });
  if (recent60s > 0) return res.status(429).json({ message: 'Attendez avant de redemander un code' });
  const recent15min = await db.mfaCodes.countRecent({ userId: ch.userId, purpose: 'login', sinceMs: 15 * 60_000 });
  if (recent15min >= 3) return res.status(429).json({ message: 'Trop de demandes, réessayez plus tard' });
  const user = await db.users.findById(ch.userId);
  if (!user) return res.status(401).json({ message: 'Aucun challenge en cours' });
  const code = await issueEmailCode(db, ch.userId, 'login');
  await mailer.sendMfaCodeEmail(user.email, code, 'login');
  res.json({ message: 'Code envoyé' });
}));

// POST /mfa/challenge/verify
// body { method, code }. method ∈ 'totp' | 'email' | 'recovery'.
router.post('/challenge/verify', wrap(async (req, res, next) => {
  const ch = getValidChallenge(req);
  if (!ch) return res.status(401).json({ message: 'Challenge expiré' });
  const { method, code } = req.body ?? {};
  if (!method || !code) return res.status(400).json({ message: 'method et code requis' });

  const db = req.app.locals.db;
  const full = await db.users.findByIdWithHash(ch.userId);
  if (!full) {
    delete req.session.mfaChallenge;
    return res.status(401).json({ message: 'Challenge expiré' });
  }

  let ok = false;
  if (method === 'totp')          ok = verifyTotpCode(full, code);
  else if (method === 'email')    ok = await verifyEmailCode(db, ch.userId, 'login', code);
  else if (method === 'recovery') ok = await consumeRecoveryCode(db, full, code);

  if (!ok) {
    ch.failedAttempts = (ch.failedAttempts || 0) + 1;
    if (ch.failedAttempts >= MAX_CHALLENGE_ATTEMPTS) {
      delete req.session.mfaChallenge;
    }
    return res.status(401).json({ message: 'Code invalide' });
  }

  const { rememberDays } = ch;
  delete req.session.mfaChallenge;
  const userForLogin = await db.users.findById(ch.userId);
  req.login(userForLogin, (err) => {
    if (err) return next(err);
    req.session.cookie.maxAge = rememberDays * 24 * 60 * 60 * 1000;
    res.json({
      _id:             userForLogin._id ?? userForLogin.id,
      email:           userForLogin.email ?? null,
      emailVerified:   userForLogin.emailVerified ?? false,
      role:            userForLogin.role ?? 'user',
      title:           userForLogin.title     ?? null,
      firstName:       userForLogin.firstName ?? null,
      lastName:        userForLogin.lastName  ?? null,
      nickname:        userForLogin.nickname  ?? null,
      avatarUrl:       userForLogin.avatarUrl ?? null,
      acceptedToSAt:   userForLogin.acceptedToSAt ?? null,
      totpEnabled:     !!userForLogin.totpEnabled,
      emailMfaEnabled: !!userForLogin.emailMfaEnabled,
      recoveryCodesRemaining: (userForLogin.recoveryCodes || []).length,
    });
  });
}));

// POST /mfa/challenge/cancel
router.post('/challenge/cancel', (req, res) => {
  if (req.session) delete req.session.mfaChallenge;
  res.json({ message: 'Challenge annulé' });
});

module.exports = {
  router,
  helpers: {
    isLocalAccount, rejectIfGoogle, issueEmailCode, verifyEmailCode,
    verifyTotpCode, consumeRecoveryCode,
    CODE_TTL_MS, CHALLENGE_TTL_MS, MAX_CHALLENGE_ATTEMPTS,
  },
};

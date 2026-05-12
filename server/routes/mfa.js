// Routes 2FA — préfixe /api/auth/mfa
// Montées depuis routes/auth.js après authLimiter.

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { authenticator } = require('otplib');
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

// Rate limiter Express générique sur les routes MFA (30 req / 15min par IP).
// Le rate-limit fin par user (1/60s sur send-email) est géré au cas par cas
// via db.mfaCodes.countRecent dans chaque handler concerné.
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(mfaLimiter);

// Helpers ────────────────────────────────────────────────────────────────────

function isLocalAccount(user) {
  return !!user.passwordHash && !user.googleId;
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
    return authenticator.check(code, secret);
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
  const secret = authenticator.generateSecret();
  const encrypted = cryptoBox.encrypt(secret);
  await db.users.updateMfa(req.user._id ?? req.user.id, {
    totpSecret: encrypted,
    totpEnabled: false,
  });
  const otpauthUrl = authenticator.keyuri(req.user.email, MFA_ISSUER, secret);
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
  if (!authenticator.check(code, secret)) {
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

module.exports = {
  router,
  helpers: {
    isLocalAccount, rejectIfGoogle, issueEmailCode, verifyEmailCode,
    verifyTotpCode, consumeRecoveryCode,
    CODE_TTL_MS, CHALLENGE_TTL_MS, MAX_CHALLENGE_ATTEMPTS,
  },
};

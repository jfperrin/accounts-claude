// Routes 2FA — préfixe /api/auth/mfa
// Montées depuis routes/auth.js après authLimiter.

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { authenticator } = require('otplib');
const _QRCode = require('qrcode');
const _wrap = require('../utils/asyncHandler');
const _requireAuth = require('../middleware/requireAuth');
const cryptoBox = require('../utils/cryptoBox');
const { generateEmailCode, generateRecoveryCodes: _generateRecoveryCodes } = require('../utils/mfaCodes');
const _mailer = require('../utils/mailer');

const _MFA_ISSUER = process.env.MFA_ISSUER || 'Comptes';
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

module.exports = {
  router,
  helpers: {
    isLocalAccount, rejectIfGoogle, issueEmailCode, verifyEmailCode,
    verifyTotpCode, consumeRecoveryCode,
    CODE_TTL_MS, CHALLENGE_TTL_MS, MAX_CHALLENGE_ATTEMPTS,
  },
};

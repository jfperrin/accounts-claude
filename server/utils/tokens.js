// Émission/vérification des tokens d'auth.
//
// - access_token : JWT HS256, durée courte (15 min), claims minimaux.
// - mfa_challenge : JWT HS256, durée 10 min, porte userId + methods + rememberDays
//   (état précédemment stocké en express-session.mfaChallenge).
// - mfa_trusted_device : JWT HS256, durée = rememberDays choisi à la 1re 2FA.
//   Permet de sauter le challenge MFA aux logins suivants depuis le même
//   navigateur. Lié à un fingerprint (passwordHash + totpSecret +
//   emailMfaEnabled) → tout changement de mot de passe ou d'état MFA invalide
//   automatiquement les anciens cookies (verifyTrustedDevice retournera ok
//   mais le fingerprint comparé en route ne matchera plus).
// - refresh_token : opaque, 32 octets aléatoires hex (256 bits d'entropie),
//   stocké hashé SHA-256 en DB. Pas besoin de signature : la simple présence
//   du hash en DB (non révoqué, non expiré) suffit à valider.
//
// SECRET : `JWT_SECRET` requis en production. En dev, fallback déterministe.

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';

function getSecret() {
  const s = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (isProd && !s) throw new Error('JWT_SECRET environment variable is required in production');
  return s || 'dev_jwt_secret';
}

const ACCESS_TTL_SEC = 15 * 60;            // 15 minutes
const MFA_CHALLENGE_TTL_SEC = 10 * 60;     // 10 minutes
const REFRESH_TTL_DAYS_DEFAULT = 30;       // surchargé par rememberDays
const TRUSTED_DEVICE_COOKIE = 'mfa_trusted_device';
const TRUSTED_DEVICE_COOKIE_PATH = '/api/auth';

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id ?? user.id),
      role: user.role ?? 'user',
    },
    getSecret(),
    { expiresIn: ACCESS_TTL_SEC, audience: 'access' },
  );
}

function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getSecret(), { audience: 'access' });
  } catch {
    return null;
  }
}

function signMfaChallenge({ userId, methods, rememberDays }) {
  return jwt.sign(
    { sub: String(userId), methods, rememberDays },
    getSecret(),
    { expiresIn: MFA_CHALLENGE_TTL_SEC, audience: 'mfa_challenge' },
  );
}

function verifyMfaChallenge(token) {
  try {
    return jwt.verify(token, getSecret(), { audience: 'mfa_challenge' });
  } catch {
    return null;
  }
}

// Fingerprint de l'état "sensible" du compte : tout changement (mot de passe,
// activation/désactivation TOTP/email MFA, rotation du secret TOTP) modifie la
// valeur et invalide donc les cookies mfa_trusted_device émis avant.
// totpSecret est stocké chiffré avec IV aléatoire → re-setup TOTP avec le même
// secret produit un ciphertext différent, donc un fingerprint différent.
function trustFingerprint(user) {
  const v = [
    user.passwordHash || '',
    user.totpSecret || '',
    user.emailMfaEnabled ? '1' : '0',
  ].join('|');
  return crypto.createHash('sha256').update(v).digest('hex').slice(0, 16);
}

function signTrustedDevice({ userId, days, fingerprint }) {
  const ttlSec = Math.max(60, Math.floor(Number(days) * 24 * 60 * 60));
  return jwt.sign(
    { sub: String(userId), fp: fingerprint },
    getSecret(),
    { expiresIn: ttlSec, audience: 'trusted_device' },
  );
}

function verifyTrustedDevice(token) {
  try {
    return jwt.verify(token, getSecret(), { audience: 'trusted_device' });
  } catch {
    return null;
  }
}

// Crée un refresh token opaque + son hash sha256 pour stockage.
function generateRefreshToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function hashRefreshToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function refreshTokenTtlMs(rememberDays) {
  const days = Number.isFinite(rememberDays) && rememberDays > 0
    ? rememberDays
    : REFRESH_TTL_DAYS_DEFAULT;
  return days * 24 * 60 * 60 * 1000;
}

// Cookies options communes — partagées par tous les cookies d'auth.
// sameSite=lax (pas strict) : nécessaire pour que les cookies soient envoyés
// au lancement d'une PWA iOS (navigation top-level depuis l'écran d'accueil
// considérée comme cross-site par WKWebView avec Strict, ce qui forçait un
// re-login à chaque ouverture). Lax garde la protection CSRF sur les
// requêtes non-navigation (XHR/fetch cross-site) sans casser le flow PWA.
function authCookieOptions({ maxAgeMs, path = '/' } = {}) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path,
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
  signTrustedDevice,
  verifyTrustedDevice,
  trustFingerprint,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenTtlMs,
  authCookieOptions,
  ACCESS_TTL_SEC,
  MFA_CHALLENGE_TTL_SEC,
  TRUSTED_DEVICE_COOKIE,
  TRUSTED_DEVICE_COOKIE_PATH,
};

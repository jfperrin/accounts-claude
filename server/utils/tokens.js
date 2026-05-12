// Émission/vérification des tokens d'auth.
//
// - access_token : JWT HS256, durée courte (15 min), claims minimaux.
// - mfa_challenge : JWT HS256, durée 10 min, porte userId + methods + rememberDays
//   (état précédemment stocké en express-session.mfaChallenge).
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
function authCookieOptions({ maxAgeMs, path = '/' } = {}) {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path,
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenTtlMs,
  authCookieOptions,
  ACCESS_TTL_SEC,
  MFA_CHALLENGE_TTL_SEC,
};

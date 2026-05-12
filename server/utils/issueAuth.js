// Émet une paire (access + refresh) en cookies httpOnly et insère le refresh
// hashé en DB. Centralise le pattern pour /login, /mfa challenge verify et /refresh.

const {
  signAccessToken,
  generateRefreshToken,
  refreshTokenTtlMs,
  authCookieOptions,
  ACCESS_TTL_SEC,
} = require('./tokens');

const REFRESH_COOKIE_PATH = '/api/auth';

async function issueAuthCookies(req, res, user, { rememberDays }) {
  const db = req.app.locals.db;
  const access = signAccessToken(user);
  const { raw, hash } = generateRefreshToken();
  const ttl = refreshTokenTtlMs(rememberDays);

  await db.refreshTokens.create({
    userId: user._id ?? user.id,
    tokenHash: hash,
    userAgent: req.get('user-agent') || null,
    ip: req.ip || null,
    expiresAt: new Date(Date.now() + ttl),
  });

  res.cookie('access_token', access, authCookieOptions({ maxAgeMs: ACCESS_TTL_SEC * 1000 }));
  res.cookie('refresh_token', raw, authCookieOptions({ maxAgeMs: ttl, path: REFRESH_COOKIE_PATH }));
}

function clearAuthCookies(res) {
  res.clearCookie('access_token', authCookieOptions());
  res.clearCookie('refresh_token', authCookieOptions({ path: REFRESH_COOKIE_PATH }));
}

module.exports = { issueAuthCookies, clearAuthCookies, REFRESH_COOKIE_PATH };

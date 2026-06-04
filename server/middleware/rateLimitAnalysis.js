const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// La limite analyse est plus stricte que la limite globale RATE_LIMIT_MAX :
// elle protège un appel coûteux (tokens Anthropic). En NODE_ENV=test on lit
// ANALYSIS_RATE_LIMIT_MAX si présent, sinon 1000 (les E2E spamment l'API ; le
// 429 dédié est testé séparément).
function resolveMax() {
  if (process.env.NODE_ENV === 'test') {
    const v = Number(process.env.ANALYSIS_RATE_LIMIT_MAX);
    return Number.isInteger(v) && v > 0 ? v : 1000;
  }
  return 10;
}

// userId quand authentifié (les routes l'exposent en _id) ; sinon ipKeyGenerator
// normalise les /64 IPv6 (sinon express-rate-limit v8 refuse au boot avec
// ERR_ERL_KEY_GEN_IPV6).
function keyGenerator(req) {
  const uid = req.user && (req.user._id ?? req.user.id);
  if (uid) return String(uid);
  return ipKeyGenerator(req.ip);
}

module.exports = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: resolveMax(),
  keyGenerator,
  message: { message: 'Trop d\'analyses cette heure. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

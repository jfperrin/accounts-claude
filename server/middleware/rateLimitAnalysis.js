const rateLimit = require('express-rate-limit');

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

module.exports = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: resolveMax(),
  keyGenerator: (req) => (req.user && String(req.user.id)) || req.ip,
  message: { message: 'Trop d\'analyses cette heure. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

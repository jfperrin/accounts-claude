// Middleware remember_me : si aucune session active mais cookie remember_me présent et valide,
// recrée une session Passport à partir du token stocké en base.
// Le token n'est pas consommé (markUsed) : il reste valide jusqu'à expiration ou logout.

const parseCookies = require('cookie').parse;

module.exports = (db) => async (req, res, next) => {
  if (req.isAuthenticated()) return next();
  const token = parseCookies(req.headers.cookie || '').remember_me;
  if (!token) return next();
  try {
    const record = await db.resetTokens.findValid(token);
    if (!record || record.type !== 'remember_me') return next();
    const user = await db.users.findById(record.userId);
    if (!user) return next();
    req.login(user, (err) => { if (err) return next(err); next(); });
  } catch (_) {
    next();
  }
};

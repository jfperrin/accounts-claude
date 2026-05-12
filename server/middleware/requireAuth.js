// Middleware de protection des routes.
// Lit le cookie `access_token` (JWT HS256), vérifie sa signature et son audience,
// puis charge l'user complet en DB pour le poser dans `req.user`.
// Sur 401 le client doit appeler /api/auth/refresh pour obtenir un nouvel access.

const { verifyAccessToken } = require('../utils/tokens');

module.exports = async (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ message: 'Non authentifié' });
  const decoded = verifyAccessToken(token);
  if (!decoded?.sub) return res.status(401).json({ message: 'Non authentifié' });

  try {
    const user = await req.app.locals.db.users.findById(decoded.sub);
    if (!user) return res.status(401).json({ message: 'Non authentifié' });
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

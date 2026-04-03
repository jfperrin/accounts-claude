// Middleware de protection des routes.
// Passport remplit req.isAuthenticated() à partir de la session restaurée.
// Si la session est absente ou expirée, on renvoie 401 sans toucher à la route.
// Placé devant chaque groupe de routes protégées dans app.js.

module.exports = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: 'Non authentifié' });
};

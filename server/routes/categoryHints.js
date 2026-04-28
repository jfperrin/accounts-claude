// Gestion du cache label → catégorie utilisé par l'auto-affectation à l'import.
// Préfixe : /api/category-hints. Toutes les routes sont protégées (req.user requis).

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/category-hints → liste des hints de l'utilisateur (utile pour debug/UI)
router.get('/', wrap(async (req, res) => {
  const hints = await req.app.locals.db.categoryHints.findByUser(req.user._id);
  res.json(hints);
}));

// POST /api/category-hints/rebuild → reconstruit le cache depuis les opérations
// catégorisées de l'utilisateur. Idempotent : truncate + insertions atomiques.
// Réponse : { count } = nombre de libellés distincts indexés.
router.post('/rebuild', wrap(async (req, res) => {
  const count = await req.app.locals.db.categoryHints.rebuildFromOperations(req.user._id);
  res.json({ count });
}));

// DELETE /api/category-hints → reset complet pour l'utilisateur (vide le cache).
// Le prochain import déclenchera un rebuild lazy depuis l'historique.
router.delete('/', wrap(async (req, res) => {
  await req.app.locals.db.categoryHints.deleteAll(req.user._id);
  res.status(204).end();
}));

module.exports = router;

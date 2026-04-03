// Routes CRUD pour les banques — protégées par requireAuth.
// Préfixe : /api/banks
//
// Toutes les opérations passent req.user._id au repo pour que chaque requête
// SQL/Mongoose soit automatiquement scopée à l'utilisateur connecté.
// Un utilisateur ne peut jamais lire ou modifier la banque d'un autre,
// même s'il connaît son ID.

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/banks → liste des banques de l'utilisateur, triées par nom
router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.banks.findByUser(req.user._id));
}));

// POST /api/banks → crée une nouvelle banque
router.post('/', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.create({ label: req.body.label, userId: req.user._id });
  res.status(201).json(bank);
}));

// PUT /api/banks/:id → met à jour le libellé. Retourne 404 si l'id
// n'appartient pas à l'utilisateur (le repo retourne null).
router.put('/:id', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.update(req.params.id, req.user._id, req.body);
  if (!bank) return res.status(404).json({ message: 'Introuvable' });
  res.json(bank);
}));

// DELETE /api/banks/:id → supprime silencieusement (204 même si introuvable)
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.banks.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;

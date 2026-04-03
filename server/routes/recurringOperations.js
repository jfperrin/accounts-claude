// Routes CRUD pour les opérations récurrentes — protégées par requireAuth.
// Préfixe : /api/recurring-operations
//
// Une opération récurrente est un modèle (template) qui définit une opération
// mensuelle (loyer, abonnement, etc.). Elle n'est pas une opération réelle :
// elle sert à générer des opérations dans une période via POST /api/operations/import-recurring.

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/recurring-operations → liste avec bankId populé { _id, label }, triée par libellé
router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.recurringOps.findByUser(req.user._id));
}));

// POST /api/recurring-operations → crée un nouveau modèle récurrent
router.post('/', wrap(async (req, res) => {
  const op = await req.app.locals.db.recurringOps.create({ ...req.body, userId: req.user._id });
  res.status(201).json(op);
}));

// PUT /api/recurring-operations/:id → mise à jour complète du modèle
router.put('/:id', wrap(async (req, res) => {
  const op = await req.app.locals.db.recurringOps.update(req.params.id, req.user._id, req.body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

// DELETE /api/recurring-operations/:id
// Supprime uniquement le modèle. Les opérations déjà importées depuis ce modèle
// ne sont pas affectées (elles existent indépendamment dans la table operations).
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.recurringOps.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;

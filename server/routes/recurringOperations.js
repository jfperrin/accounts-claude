// Routes CRUD pour les opérations récurrentes — protégées par requireAuth.
// Préfixe : /api/recurring-operations
//
// Une opération récurrente est un modèle (template) qui définit une opération
// mensuelle (loyer, abonnement, etc.). Elle n'est pas une opération réelle :
// elle sert à générer des opérations dans une période via POST /api/operations/import-recurring.

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');
const { detectRecurringSuggestions } = require('../services/recurringDetectionService');

// GET /api/recurring-operations → liste avec bankId populé { _id, label }, triée par libellé
router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.recurringOps.findByUser(req.user._id));
}));

// GET /api/recurring-operations/suggestions → suggestions de récurrentes détectées
// dans l'historique des opérations (12 derniers mois). Exclut celles déjà couvertes
// par un modèle existant ou ignorées par l'utilisateur.
router.get('/suggestions', wrap(async (req, res) => {
  const { operations, recurringOps, dismissedRecurringSuggestions, banks } =
    req.app.locals.db;
  const userId = req.user._id;

  const [ops, recurring, dismissed, banksList] = await Promise.all([
    operations.findAllMinimal(userId),
    recurringOps.findByUserRaw(userId),
    dismissedRecurringSuggestions.findKeysByUser(userId),
    banks.findByUser(userId),
  ]);

  const suggestions = detectRecurringSuggestions(ops, recurring, dismissed);
  // Populate le label de la banque pour l'affichage côté client.
  const bankById = new Map(banksList.map((b) => [String(b._id), b]));
  for (const s of suggestions) {
    const b = bankById.get(String(s.bankId));
    s.bank = b ? { _id: b._id, label: b.label } : null;
  }
  res.json(suggestions);
}));

// POST /api/recurring-operations/suggestions/dismiss  body: { key }
// Marque une suggestion comme ignorée (persistant, par utilisateur).
router.post('/suggestions/dismiss', wrap(async (req, res) => {
  const { key } = req.body || {};
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ message: 'key requis' });
  }
  await req.app.locals.db.dismissedRecurringSuggestions.add(req.user._id, key);
  res.status(204).end();
}));

// DELETE /api/recurring-operations/suggestions/dismiss/:key
// Réactive une suggestion précédemment ignorée.
router.delete('/suggestions/dismiss/:key', wrap(async (req, res) => {
  await req.app.locals.db.dismissedRecurringSuggestions.remove(req.user._id, req.params.key);
  res.status(204).end();
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

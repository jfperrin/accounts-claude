// Routes CRUD pour les banques — protégées par requireAuth.
// Préfixe : /api/banks
//
// Toutes les opérations passent req.user._id au repo pour que chaque requête
// SQL/Mongoose soit automatiquement scopée à l'utilisateur connecté.
//
// GET /api/banks enrichit chaque banque avec un `projectedBalance` :
//     projectedBalance = currentBalance + Σ amounts des Operation non pointées
// (toutes dates confondues — passé non rapproché et futur non encore réalisé).

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/banks → banques de l'utilisateur, triées par nom, enrichies du
// projectedBalance calculé serveur (pour éviter une requête supplémentaire côté UI).
router.get('/', wrap(async (req, res) => {
  const { banks, operations } = req.app.locals.db;
  const userId = req.user._id;

  const list = await banks.findByUser(userId);
  const sumByBank = await operations.sumUnpointedByBank(userId);

  // Mongoose retourne des Documents : on lit via .toObject() si nécessaire,
  // sinon (SQLite) ce sont déjà des objets plain. On normalise via String(_id)
  // pour la lookup dans sumByBank (qui keye en string dans les deux backends).
  const enriched = list.map((b) => {
    const plain = typeof b.toObject === 'function' ? b.toObject() : b;
    const key = String(plain._id);
    const unpointed = sumByBank[key] || 0;
    return { ...plain, projectedBalance: (plain.currentBalance || 0) + unpointed };
  });

  res.json(enriched);
}));

// POST /api/banks → crée une banque (currentBalance optionnel, défaut 0)
router.post('/', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.create({
    label: req.body.label,
    currentBalance: req.body.currentBalance,
    userId: req.user._id,
  });
  res.status(201).json(bank);
}));

// PUT /api/banks/:id → met à jour label et/ou currentBalance.
// Les champs absents du body ne sont pas modifiés (undefined).
router.put('/:id', wrap(async (req, res) => {
  const bank = await req.app.locals.db.banks.update(req.params.id, req.user._id, {
    label: req.body.label,
    currentBalance: req.body.currentBalance,
  });
  if (!bank) return res.status(404).json({ message: 'Introuvable' });
  res.json(bank);
}));

// DELETE /api/banks/:id → supprime silencieusement (204 même si introuvable)
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.banks.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

module.exports = router;

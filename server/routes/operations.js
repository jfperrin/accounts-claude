// Routes CRUD pour les opérations — protégées par requireAuth.
// Préfixe : /api/operations
//
// Une opération appartient toujours à une période et une banque.
// Toutes les réponses contiennent bankId populé { _id, label } pour
// que le client puisse afficher le nom de la banque sans requête supplémentaire.

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/operations?periodId=xxx → opérations d'une période, triées par date
// periodId est obligatoire : on ne charge jamais toutes les opérations de l'utilisateur.
router.get('/', wrap(async (req, res) => {
  const { periodId } = req.query;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });
  res.json(await req.app.locals.db.operations.findByPeriod(periodId, req.user._id));
}));

// POST /api/operations → crée une opération dans la période spécifiée dans le body
router.post('/', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.create({ ...req.body, userId: req.user._id });
  res.status(201).json(op);
}));

// PUT /api/operations/:id → met à jour label, montant, date ou banque
router.put('/:id', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.update(req.params.id, req.user._id, req.body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

// DELETE /api/operations/:id
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.operations.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

// PATCH /api/operations/:id/point → inverse l'état pointé de l'opération.
// "Pointer" une opération signifie qu'elle a été vérifiée sur le relevé bancaire.
// Les opérations pointées sont visuellement grisées dans l'UI et exclues du prévisionnel.
router.patch('/:id/point', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.togglePointed(req.params.id, req.user._id);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

// POST /api/operations/import-recurring
// Importe les opérations récurrentes dans une période donnée.
// Idempotent : une opération récurrente déjà présente dans la période
// (même label, même banque, même montant) n'est pas dupliquée.
//
// Algorithme :
//  1. Charge la période pour connaître mois/année et calculer la date exacte
//  2. Charge les opérations récurrentes de l'utilisateur
//  3. Construit un Set des clés "label|bankId|montant" déjà présentes dans la période
//  4. Filtre les récurrentes absentes du Set, calcule leur date (en tenant compte
//     des mois courts : ex. 31 février → dernier jour du mois)
//  5. Insère toutes les nouvelles opérations en une seule passe (insertMany)
router.post('/import-recurring', wrap(async (req, res) => {
  const { periodId } = req.body;
  if (!periodId) return res.status(400).json({ message: 'periodId requis' });

  const { operations, periods, recurringOps } = req.app.locals.db;
  const userId = req.user._id;

  const period = await periods.findOne(periodId, userId);
  if (!period) return res.status(404).json({ message: 'Période introuvable' });

  const recurring = await recurringOps.findByUserRaw(userId);
  if (!recurring.length) return res.json({ imported: 0 });

  // findByPeriodMinimal retourne bankId sous forme d'ID brut (sans populate)
  // pour que la comparaison avec r.bankId soit cohérente des deux côtés
  const existing = await operations.findByPeriodMinimal(periodId, userId);
  const existingKeys = new Set(existing.map((o) => `${o.label}|${o.bankId}|${o.amount}`));

  const toInsert = recurring
    .filter((r) => !existingKeys.has(`${r.label}|${r.bankId}|${r.amount}`))
    .map((r) => {
      // Math.min évite les jours invalides (ex: jour 31 en février → jour 28/29)
      const day = Math.min(r.dayOfMonth, new Date(period.year, period.month, 0).getDate());
      return {
        label: r.label,
        amount: r.amount,
        date: new Date(period.year, period.month - 1, day),
        bankId: r.bankId,
        periodId,
        userId,
        pointed: false,
      };
    });

  await operations.insertMany(toInsert);
  res.json({ imported: toInsert.length });
}));

module.exports = router;

// Routes CRUD pour les périodes — protégées par requireAuth.
// Préfixe : /api/periods
//
// Une période représente un mois/année pour un utilisateur donné.
// Elle est créée à la demande depuis DashboardPage (pas de pré-création).
// Elle stocke aussi les soldes initiaux par banque (champ balances).

const router = require('express').Router();
const wrap = require('../utils/asyncHandler');

// GET /api/periods → liste de toutes les périodes de l'utilisateur, triées
// du plus récent au plus ancien (pour peupler les sélecteurs du dashboard)
router.get('/', wrap(async (req, res) => {
  res.json(await req.app.locals.db.periods.findByUser(req.user._id));
}));

// POST /api/periods → crée une période pour un mois/an donné.
// La contrainte UNIQUE(month, year, userId) garantit l'unicité en base.
// En cas de doublon, MongoDB lève err.code 11000, SQLite lève une erreur
// avec ce même code (simulé dans db/sqlite.js) → on renvoie 409 dans les deux cas.
router.post('/', wrap(async (req, res) => {
  try {
    const period = await req.app.locals.db.periods.create({ ...req.body, userId: req.user._id });
    res.status(201).json(period);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Cette période existe déjà' });
    throw err;
  }
}));

// PATCH /api/periods/:id/balances
// Met à jour les soldes initiaux par banque pour cette période.
// Le body est un objet { bankId: solde, ... } qui remplace intégralement le champ balances.
// Ces soldes sont utilisés côté client pour calculer le prévisionnel de chaque banque.
router.patch('/:id/balances', wrap(async (req, res) => {
  const period = await req.app.locals.db.periods.updateBalances(req.params.id, req.user._id, req.body);
  if (!period) return res.status(404).json({ message: 'Introuvable' });
  res.json(period);
}));

// DELETE /api/periods/:id
// Supprime la période ET toutes ses opérations (cascade manuelle).
// La cascade n'est pas automatique en SQLite (foreign key ON DELETE CASCADE
// n'est pas configuré) ni dans Mongoose → on la fait explicitement ici.
router.delete('/:id', wrap(async (req, res) => {
  const { periods, operations } = req.app.locals.db;
  const period = await periods.delete(req.params.id, req.user._id);
  if (period) await operations.deleteByPeriod(period._id, req.user._id);
  res.status(204).end();
}));

module.exports = router;

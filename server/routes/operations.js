// Routes CRUD pour les opérations — protégées par requireAuth.
// Préfixe : /api/operations
//
// Une opération appartient à une banque et est datée. Plus de notion de période :
// on filtre par mois/année via les query params `?month=M&year=YYYY`.
// Sans paramètre, on renvoie le mois courant.

const router = require('express').Router();
const multer = require('multer');
const wrap = require('../utils/asyncHandler');
const importService = require('../services/importService');

// Multer mémoire pour l'import (1 Mo max).
// Accepte .qif, .ofx ou .zip (qui doit contenir un de ces formats).
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(qif|ofx|zip)$/i.test(file.originalname)) {
      return cb(new Error('Seuls les fichiers .qif, .ofx ou .zip sont acceptés'));
    }
    cb(null, true);
  },
});

// Parse + valide les query params startDate/endDate (format YYYY-MM-DD).
// Par défaut : les 30 derniers jours. Lève 400 si les dates sont invalides.
function parseDateRange(query) {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end: new Date(end.getTime() + 1) };
  }
  if (!startDate || !endDate) {
    const err = new Error('startDate et endDate sont tous les deux requis');
    err.status = 400;
    throw err;
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1); // borne exclusive
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    const err = new Error('Dates invalides');
    err.status = 400;
    throw err;
  }
  return { start, end };
}

// GET /api/operations?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Liste les opérations dans la plage donnée. Sans param → 30 derniers jours.
router.get('/', wrap(async (req, res) => {
  const { start, end } = parseDateRange(req.query);
  res.json(await req.app.locals.db.operations.findByDateRange(start, end, req.user._id));
}));

// POST /api/operations → crée une opération (body sans periodId).
router.post('/', wrap(async (req, res) => {
  const { categoryHints } = req.app.locals.db;
  const op = await req.app.locals.db.operations.create({ ...req.body, userId: req.user._id });
  // Synchronise le cache hints : nouvelle op catégorisée → upsert
  if (op && op.category) {
    await categoryHints.upsert(req.user._id, op.label, op.category);
  }
  res.status(201).json(op);
}));

// PUT /api/operations/:id → met à jour label, montant, date, banque ou pointed
router.put('/:id', wrap(async (req, res) => {
  const { operations, categoryHints } = req.app.locals.db;
  const op = await operations.update(req.params.id, req.user._id, req.body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  // Synchronise le cache hints sur changement de catégorie :
  //  - catégorie posée → upsert (label, category)
  //  - catégorie effacée → delete (label)
  if (req.body.category !== undefined) {
    if (req.body.category) {
      await categoryHints.upsert(req.user._id, op.label, req.body.category);
    } else {
      await categoryHints.deleteHint(req.user._id, op.label);
    }
  }
  res.json(op);
}));

// DELETE /api/operations/:id
router.delete('/:id', wrap(async (req, res) => {
  await req.app.locals.db.operations.delete(req.params.id, req.user._id);
  res.status(204).end();
}));

// PATCH /api/operations/:id/point → inverse l'état pointé.
router.patch('/:id/point', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.togglePointed(req.params.id, req.user._id);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

// POST /api/operations/generate-recurring  body: { month, year }
// Génère les opérations issues des récurrents pour le mois cible.
// Idempotent : on dédup par clé `label|bankId|amount|YYYY-MM-DD`.
router.post('/generate-recurring', wrap(async (req, res) => {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return res.status(400).json({ message: 'month/year requis et valides' });
  }

  const { operations, recurringOps } = req.app.locals.db;
  const userId = req.user._id;

  const recurring = await recurringOps.findByUserRaw(userId);
  if (!recurring.length) return res.json({ imported: 0 });

  const existing = await operations.findByMonthMinimal(month, year, userId);
  const keyOf = (label, bankId, amount, date) =>
    `${label}|${bankId}|${amount}|${new Date(date).toISOString().slice(0, 10)}`;
  const existingKeys = new Set(
    existing.map((o) => {
      const bId = o.bankId && o.bankId._id ? String(o.bankId._id) : String(o.bankId);
      return keyOf(o.label, bId, o.amount, o.date);
    }),
  );

  // Pour chaque récurrent, on calcule le jour effectif (Math.min pour février),
  // on construit l'op datée et on dédup avant insertion.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const toInsert = [];
  for (const r of recurring) {
    const day = Math.min(r.dayOfMonth, lastDay);
    const date = new Date(Date.UTC(year, month - 1, day));
    const key = keyOf(r.label, String(r.bankId), r.amount, date);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    toInsert.push({
      label: r.label,
      amount: r.amount,
      date,
      bankId: r.bankId,
      userId,
      pointed: false,
      category: r.category ?? null,
    });
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  res.json({ imported: toInsert.length });
}));

// POST /api/operations/import  (multipart/form-data) — fields: file, bankId
router.post('/import', (req, res, next) => {
  importUpload.single('file')(req, res, (err) => err ? next(err) : next());
}, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fichier requis (champ "file")' });
  const { bankId } = req.body;
  if (!bankId) return res.status(400).json({ message: 'bankId requis' });
  const result = await importService.processImportFile(req.file, bankId, req.user._id, req.app.locals.db);
  res.json(result);
}));

// POST /api/operations/import/resolve  body: { resolutions: [{ importedRow, selectedOpIds }] }
router.post('/import/resolve', wrap(async (req, res) => {
  const { resolutions } = req.body || {};
  if (!Array.isArray(resolutions)) {
    return res.status(400).json({ message: 'resolutions[] requis' });
  }
  const result = await importService.resolveImportMatches(resolutions, req.user._id, req.app.locals.db);
  res.json(result);
}));

module.exports = router;

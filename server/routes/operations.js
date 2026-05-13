// Routes CRUD pour les opérations — protégées par requireAuth.
// Préfixe : /api/operations
//
// Une opération appartient à une banque et est datée. Plus de notion de période :
// on filtre par mois/année via les query params `?month=M&year=YYYY`.
// Sans paramètre, on renvoie le mois courant.

const router = require('express').Router();
const multer = require('multer');
const { randomUUID } = require('crypto');
const wrap = require('../utils/asyncHandler');
const importService = require('../services/importService');
const { findSimilarUncategorized, findSimilarExcludingCategory } = require('../services/categoryPropagationService');
const { detectTransferCandidates } = require('../services/transferDetectionService');

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

// GET /api/operations/unpointed
// Liste les opérations non pointées de l'utilisateur (toutes dates confondues).
// Sert HomePage.UnpointedOperationsList — évite de rapatrier l'historique
// complet (1900–2099) puis de filtrer côté client.
router.get('/unpointed', wrap(async (req, res) => {
  res.json(await req.app.locals.db.operations.findUnpointed(req.user._id));
}));

// GET /api/operations?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Liste les opérations dans la plage donnée. Sans param → 30 derniers jours.
router.get('/', wrap(async (req, res) => {
  const { start, end } = parseDateRange(req.query);
  const filters = {};
  if (req.query.q) filters.q = String(req.query.q).trim().slice(0, 200);
  if (req.query.categoryId) filters.categoryId = String(req.query.categoryId);
  if (req.query.pointed === 'true') filters.pointed = true;
  else if (req.query.pointed === 'false') filters.pointed = false;
  if (req.query.bankId) filters.bankId = String(req.query.bankId);
  res.json(await req.app.locals.db.operations.findByDateRange(start, end, req.user._id, filters));
}));

// POST /api/operations → crée une opération (body sans periodId).
router.post('/', wrap(async (req, res) => {
  const { categoryHints } = req.app.locals.db;
  // Toute catégorie posée par cette route est une saisie utilisateur → 'manual'.
  // Les ops auto-classifiées passent par le service d'import, pas par /POST.
  const payload = { ...req.body, userId: req.user._id };
  if (payload.categoryId) payload.categorySource = 'manual';
  const op = await req.app.locals.db.operations.create(payload);
  if (op && op.categoryId) {
    await categoryHints.upsert(req.user._id, op.label, op.categoryId);
  }
  res.status(201).json(op);
}));

// PUT /api/operations/:id → met à jour label, montant, date, banque ou pointed
router.put('/:id', wrap(async (req, res) => {
  const { operations, categoryHints } = req.app.locals.db;
  // Si l'utilisateur touche la catégorie, on bascule la source en 'manual'
  // (ou null si la catégorie est effacée).
  const body = { ...req.body };
  if (body.categoryId !== undefined) {
    body.categorySource = body.categoryId ? 'manual' : null;
  }
  const op = await operations.update(req.params.id, req.user._id, body);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  // Synchronise le cache hints sur changement de catégorie :
  //  - catégorie posée → upsert (label, categoryId)
  //  - catégorie effacée → delete (label)
  if (req.body.categoryId !== undefined) {
    if (req.body.categoryId) {
      await categoryHints.upsert(req.user._id, op.label, req.body.categoryId);
    } else {
      await categoryHints.deleteHint(req.user._id, op.label);
    }
  }
  res.json(op);
}));

// DELETE /api/operations/:id
// Si l'opération fait partie d'un virement interne (transferId non null),
// les deux opérations liées sont supprimées en cascade.
router.delete('/:id', wrap(async (req, res) => {
  const { operations } = req.app.locals.db;
  const op = await operations.findById(req.params.id, req.user._id);
  if (!op) return res.status(204).end();
  if (op.transferId) {
    await operations.deleteByTransferId(op.transferId, req.user._id);
  } else {
    await operations.delete(req.params.id, req.user._id);
  }
  res.status(204).end();
}));

// POST /api/operations/transfer → virement interne entre deux banques.
// Body: { fromBankId, toBankId, amount > 0, date, label? }
// Crée 2 opérations liées par un même transferId UUID :
//   - sur fromBankId : -amount, libellé "→ <bank cible>" (ou label custom)
//   - sur toBankId   : +amount, libellé "← <bank source>"
router.post('/transfer', wrap(async (req, res) => {
  const { fromBankId, toBankId, date } = req.body;
  const amount = Number(req.body.amount);
  if (!fromBankId || !toBankId) return res.status(400).json({ message: 'fromBankId et toBankId requis' });
  if (String(fromBankId) === String(toBankId)) return res.status(400).json({ message: 'Les banques source et destination doivent être différentes' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'Montant positif requis' });
  if (!date) return res.status(400).json({ message: 'Date requise' });

  const { banks, operations } = req.app.locals.db;
  const [fromBank, toBank] = await Promise.all([
    banks.findById(fromBankId, req.user._id),
    banks.findById(toBankId, req.user._id),
  ]);
  if (!fromBank || !toBank) return res.status(404).json({ message: 'Banque introuvable' });

  const transferId = randomUUID();
  const customLabel = req.body.label ? String(req.body.label).trim() : '';
  const outLabel = customLabel || `Virement → ${toBank.label}`;
  const inLabel  = customLabel || `Virement ← ${fromBank.label}`;
  const userId = req.user._id;

  const out = await operations.create({ label: outLabel, amount: -amount, date, bankId: fromBankId, userId, transferId });
  const inn = await operations.create({ label: inLabel,  amount:  amount, date, bankId: toBankId,   userId, transferId });
  res.status(201).json([out, inn]);
}));

// GET /api/operations/transfer-candidates
// Détecte les paires d'opérations non liées qui sont probablement les deux
// jambes d'un virement interbanque (mêmes critères que detectTransferCandidates :
// banques différentes, montants opposés, ±5 j). À confirmer par l'utilisateur
// avant d'appeler /link-transfer.
router.get('/transfer-candidates', wrap(async (req, res) => {
  const { operations, banks } = req.app.locals.db;
  const [ops, userBanks] = await Promise.all([
    operations.findAllMinimal(req.user._id),
    banks.findByUser(req.user._id),
  ]);
  const pairs = detectTransferCandidates(ops, userBanks);
  // Renvoie les ops complètes (le client a besoin du libellé, de la banque
  // populée et de la date pour la preview de chaque paire candidate).
  const ids = new Set();
  for (const p of pairs) { ids.add(String(p.outOp._id)); ids.add(String(p.inOp._id)); }
  const fullOps = new Map();
  for (const id of ids) {
    const full = await operations.findById(id, req.user._id);
    if (full) fullOps.set(String(full._id), full);
  }
  res.json(pairs.map((p) => ({
    confidence: p.confidence,
    outOp: fullOps.get(String(p.outOp._id)),
    inOp: fullOps.get(String(p.inOp._id)),
  })));
}));

// POST /api/operations/:id/link-transfer  body: { otherId }
// Lie deux opérations existantes en virement interne via un transferId
// commun. Renvoie 400 si les contraintes ne sont pas remplies.
router.post('/:id/link-transfer', wrap(async (req, res) => {
  const { otherId } = req.body;
  if (!otherId) return res.status(400).json({ message: 'otherId requis' });
  const { operations } = req.app.locals.db;
  const result = await operations.linkAsTransfer(req.params.id, otherId, req.user._id);
  if (result.error) {
    const map = {
      NOT_FOUND: { status: 404, msg: 'Opération introuvable' },
      SAME_OP: { status: 400, msg: 'Impossible de lier une opération à elle-même' },
      ALREADY_LINKED: { status: 400, msg: 'Au moins une des opérations est déjà liée à un virement' },
      SAME_BANK: { status: 400, msg: 'Les deux opérations doivent être sur des banques différentes' },
      AMOUNT_MISMATCH: { status: 400, msg: 'Les montants doivent être exactement opposés' },
    };
    const e = map[result.error] || { status: 400, msg: 'Lien impossible' };
    return res.status(e.status).json({ message: e.msg });
  }
  res.json(result);
}));

// DELETE /api/operations/:id/transfer-link
// Retire le transferId des deux jambes du virement (sans supprimer les ops).
router.delete('/:id/transfer-link', wrap(async (req, res) => {
  const { operations } = req.app.locals.db;
  const op = await operations.findById(req.params.id, req.user._id);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  if (!op.transferId) return res.status(400).json({ message: "Cette opération n'est pas liée à un virement" });
  const cleared = await operations.unlinkTransfer(op.transferId, req.user._id);
  res.json({ cleared });
}));

// PATCH /api/operations/:id/point → inverse l'état pointé.
router.patch('/:id/point', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.togglePointed(req.params.id, req.user._id);
  if (!op) return res.status(404).json({ message: 'Introuvable' });
  res.json(op);
}));

// Calcule la date cible et les "clés" (label|bankId|amount|YYYY-MM-DD) d'une
// récurrente pour un mois donné. Renvoie aussi l'op (ou la paire d'ops pour
// les transferts) à insérer. Utilisé par /generate-recurring et /recurring-preview.
function planRecurring(r, month, year, bankLabelById, userId) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(r.dayOfMonth, lastDay);
  const date = new Date(Date.UTC(year, month - 1, day));
  const keyOf = (label, bankId, amount, d) =>
    `${label}|${bankId}|${amount}|${new Date(d).toISOString().slice(0, 10)}`;

  if (r.toBankId) {
    const abs = Math.abs(Number(r.amount));
    const fromBank = String(r.bankId);
    const toBank = String(r.toBankId);
    const outLabel = r.label || `Virement → ${bankLabelById.get(toBank) || 'banque'}`;
    const inLabel  = r.label || `Virement ← ${bankLabelById.get(fromBank) || 'banque'}`;
    return {
      date,
      keys: [keyOf(outLabel, fromBank, -abs, date), keyOf(inLabel, toBank, abs, date)],
      build: () => {
        const transferId = randomUUID();
        return [
          { label: outLabel, amount: -abs, date, bankId: r.bankId,   userId, pointed: false, categoryId: null, transferId },
          { label: inLabel,  amount:  abs, date, bankId: r.toBankId, userId, pointed: false, categoryId: null, transferId },
        ];
      },
    };
  }

  return {
    date,
    keys: [keyOf(r.label, String(r.bankId), r.amount, date)],
    build: () => [{
      label: r.label,
      amount: r.amount,
      date,
      bankId: r.bankId,
      userId,
      pointed: false,
      categoryId: r.categoryId ?? null,
      categorySource: r.categoryId ? 'manual' : null,
    }],
  };
}

async function buildRecurringContext(db, userId, month, year) {
  const existing = await db.operations.findByMonthMinimal(month, year, userId);
  const existingKeys = new Set(
    existing.map((o) => {
      const bId = o.bankId && o.bankId._id ? String(o.bankId._id) : String(o.bankId);
      return `${o.label}|${bId}|${o.amount}|${new Date(o.date).toISOString().slice(0, 10)}`;
    }),
  );
  const banksList = await db.banks.findByUser(userId);
  const bankLabelById = new Map(banksList.map((b) => [String(b._id), b.label]));
  return { existingKeys, bankLabelById };
}

// GET /api/operations/recurring-preview?month=M&year=YYYY
// Aperçu : pour chaque récurrente, date cible + déjà-importée?
router.get('/recurring-preview', wrap(async (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return res.status(400).json({ message: 'month/year requis et valides' });
  }
  const { recurringOps } = req.app.locals.db;
  const userId = req.user._id;
  const recurring = await recurringOps.findByUserRaw(userId);
  const { existingKeys, bankLabelById } = await buildRecurringContext(req.app.locals.db, userId, month, year);
  const items = recurring.map((r) => {
    const plan = planRecurring(r, month, year, bankLabelById, userId);
    const alreadyImported = plan.keys.some((k) => existingKeys.has(k));
    return {
      recurringId: String(r._id),
      date: plan.date.toISOString().slice(0, 10),
      alreadyImported,
    };
  });
  res.json({ items });
}));

// POST /api/operations/generate-recurring  body: { month, year, recurringIds? }
// Génère les opérations issues des récurrents pour le mois cible.
// Idempotent : on dédup par clé `label|bankId|amount|YYYY-MM-DD`.
// Si recurringIds est fourni (tableau), on filtre la liste des récurrentes.
router.post('/generate-recurring', wrap(async (req, res) => {
  const month = Number(req.body.month);
  const year = Number(req.body.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return res.status(400).json({ message: 'month/year requis et valides' });
  }

  const { operations, recurringOps } = req.app.locals.db;
  const userId = req.user._id;

  const allRecurring = await recurringOps.findByUserRaw(userId);
  if (!allRecurring.length) return res.json({ imported: 0 });

  let recurring = allRecurring;
  if (Array.isArray(req.body.recurringIds)) {
    const ids = new Set(req.body.recurringIds.map(String));
    recurring = allRecurring.filter((r) => ids.has(String(r._id)));
    if (!recurring.length) return res.json({ imported: 0 });
  }

  const { existingKeys, bankLabelById } = await buildRecurringContext(req.app.locals.db, userId, month, year);

  const toInsert = [];
  for (const r of recurring) {
    const plan = planRecurring(r, month, year, bankLabelById, userId);
    if (plan.keys.some((k) => existingKeys.has(k))) continue;
    for (const k of plan.keys) existingKeys.add(k);
    toInsert.push(...plan.build());
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  res.json({ imported: toInsert.length });
}));

// GET /api/operations/similar-uncategorized?label=...&bankId=...[&excludeId=...]
// Variante "sans op source en base" : utile pour les patterns synthétiques
// (ex. après création d'une récurrente) où on veut chercher dans l'historique
// les opérations correspondantes à catégoriser en lot.
router.get('/similar-uncategorized', wrap(async (req, res) => {
  const { label, bankId, excludeId, referenceDate } = req.query;
  if (!label || typeof label !== 'string') {
    return res.status(400).json({ message: 'label requis' });
  }
  if (!bankId || typeof bankId !== 'string') {
    return res.status(400).json({ message: 'bankId requis' });
  }
  const all = await req.app.locals.db.operations.findAllMinimal(req.user._id);
  const matches = findSimilarUncategorized(all, label, bankId, excludeId || null, referenceDate || null);
  res.json(matches.map((o) => ({
    _id: o._id, label: o.label, amount: o.amount, date: o.date,
  })));
}));

// GET /api/operations/:id/similar-uncategorized
// Renvoie les opérations sans catégorie de la même banque dont le libellé est
// similaire à celui de l'op source. Utilisé pour proposer une catégorisation
// en lot après affectation d'une catégorie.
router.get('/:id/similar-uncategorized', wrap(async (req, res) => {
  const { operations } = req.app.locals.db;
  const userId = req.user._id;
  const source = await operations.findById(req.params.id, userId);
  if (!source) return res.status(404).json({ message: 'Introuvable' });
  const sourceBankId = source.bankId && source.bankId._id ? source.bankId._id : source.bankId;
  const all = await operations.findAllMinimal(userId);
  const matches = findSimilarUncategorized(all, source.label, sourceBankId, source._id, source.date);
  res.json(matches.map((o) => ({
    _id: o._id, label: o.label, amount: o.amount, date: o.date,
  })));
}));

// GET /api/operations/:id/similar?excludeCategoryId=...
// Variante du précédent pour le cas "changement de catégorie d'une op déjà
// catégorisée" : retourne les ops similaires (uncat + autres catégories) qui
// ne sont PAS dans la catégorie cible. Permet de proposer la propagation
// même quand les ops similaires ont une (autre) catégorie.
router.get('/:id/similar', wrap(async (req, res) => {
  const { operations } = req.app.locals.db;
  const userId = req.user._id;
  const source = await operations.findById(req.params.id, userId);
  if (!source) return res.status(404).json({ message: 'Introuvable' });
  const sourceBankId = source.bankId && source.bankId._id ? source.bankId._id : source.bankId;
  const all = await operations.findAllMinimal(userId);
  const excludeCategoryId = req.query.excludeCategoryId || null;
  const matches = findSimilarExcludingCategory(all, source.label, sourceBankId, source._id, source.date, excludeCategoryId);
  res.json(matches.map((o) => ({
    _id: o._id,
    label: o.label,
    amount: o.amount,
    date: o.date,
    categoryId: o.categoryId ? String(o.categoryId?._id ?? o.categoryId) : null,
  })));
}));

// POST /api/operations/bulk-categorize  body: { ids: string[], categoryId: string }
// Affecte la catégorie aux opérations listées et synchronise les hints.
router.post('/bulk-categorize', wrap(async (req, res) => {
  const { ids, categoryId } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids[] requis' });
  }
  if (!categoryId || typeof categoryId !== 'string') {
    return res.status(400).json({ message: 'categoryId requis' });
  }
  const { operations, categoryHints } = req.app.locals.db;
  const userId = req.user._id;
  let updated = 0;
  for (const id of ids) {
    const op = await operations.update(id, userId, { categoryId });
    if (!op) continue;
    await categoryHints.upsert(userId, op.label, categoryId);
    updated++;
  }
  res.json({ updated });
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

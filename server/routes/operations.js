// Routes CRUD pour les opérations — protégées par requireAuth.
// Préfixe : /api/operations
//
// Une opération appartient à une banque et est datée. Plus de notion de période :
// on filtre par mois/année via les query params `?month=M&year=YYYY`.
// Sans paramètre, on renvoie le mois courant.

const router = require('express').Router();
const multer = require('multer');
const AdmZip = require('adm-zip');
const wrap = require('../utils/asyncHandler');
const { parseBankQif } = require('../utils/parseQif');
const { parseBankOfx } = require('../utils/parseOfx');
const { labelSimilarity } = require('../utils/labelSimilarity');

// Seuil unique de similarité utilisé pour :
//   - inférer la catégorie d'une op à partir d'opérations existantes au libellé proche
//   - réconcilier une ligne d'import avec une opération existante de même montant
//     dont le libellé est suffisamment proche
const SIMILARITY_THRESHOLD = 0.7;

// Cherche la catégorie d'une opération existante dont le libellé est similaire
// à `label` à au moins SIMILARITY_THRESHOLD. Priorité à la correspondance exacte.
function inferCategory(existing, label) {
  let best = null;
  let bestScore = SIMILARITY_THRESHOLD - Number.EPSILON;
  for (const o of existing) {
    if (!o.category) continue;
    const score = labelSimilarity(o.label, label);
    if (score > bestScore) {
      bestScore = score;
      best = o.category;
      if (score === 1) break;
    }
  }
  return best;
}

// Trouve parmi les candidats celui dont le libellé est le plus proche de `label`,
// à condition que le score atteigne SIMILARITY_THRESHOLD. Retourne null sinon.
function bestSimilarCandidate(candidates, label) {
  let best = null;
  let bestScore = SIMILARITY_THRESHOLD - Number.EPSILON;
  for (const c of candidates) {
    const score = labelSimilarity(c.label, label);
    if (score > bestScore) {
      bestScore = score;
      best = c;
      if (score === 1) break;
    }
  }
  return best;
}

// Multer mémoire pour l'import (1 Mo max).
// Accepte .qif, .ofx ou .zip (qui doit contenir un de ces formats).
// Le CSV n'est plus accepté : QIF/OFX sont plus stables (encodage déclaré,
// codes de champs fixes) et suffisent aux exports Fortuneo/BP.
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

// Détermine le format d'import à partir d'un nom de fichier.
// Retourne 'qif' | 'ofx' | null.
function formatFromName(name) {
  if (/\.qif$/i.test(name)) return 'qif';
  if (/\.ofx$/i.test(name)) return 'ofx';
  return null;
}

// Extrait le contenu à parser depuis le fichier uploadé. Retourne
// `{ buffer, format }` où format ∈ {'qif', 'ofx'}.
// Pour un ZIP, on prend la première entrée valide en ignorant les résidus
// macOS (__MACOSX/). Lève une erreur 400 si zip invalide ou vide.
function extractImportPayload(file) {
  const directFormat = formatFromName(file.originalname);
  if (directFormat) {
    return { buffer: file.buffer, format: directFormat };
  }
  // Reste : .zip (filtré par multer en amont)
  let zip;
  try {
    zip = new AdmZip(file.buffer);
  } catch (_) {
    const err = new Error('Archive ZIP invalide');
    err.status = 400;
    throw err;
  }
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (entry.entryName.startsWith('__MACOSX/')) continue;
    const fmt = formatFromName(entry.entryName);
    if (fmt) return { buffer: entry.getData(), format: fmt };
  }
  const err = new Error('Aucun .qif ou .ofx trouvé dans l\'archive');
  err.status = 400;
  throw err;
}

// Parse + valide les query params month/year.
// Renvoie le mois courant si absents. Lève une erreur 400 si mal formés.
function parseMonthYear(query) {
  const now = new Date();
  const month = query.month != null ? Number(query.month) : now.getUTCMonth() + 1;
  const year = query.year != null ? Number(query.year) : now.getUTCFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    const err = new Error('month/year invalides');
    err.status = 400;
    throw err;
  }
  return { month, year };
}

// GET /api/operations?month=M&year=YYYY
// Liste les opérations du mois donné, triées par date. Sans param → mois courant.
router.get('/', wrap(async (req, res) => {
  const { month, year } = parseMonthYear(req.query);
  res.json(await req.app.locals.db.operations.findByMonth(month, year, req.user._id));
}));

// POST /api/operations → crée une opération (body sans periodId).
router.post('/', wrap(async (req, res) => {
  const op = await req.app.locals.db.operations.create({ ...req.body, userId: req.user._id });
  res.status(201).json(op);
}));

// PUT /api/operations/:id → met à jour label, montant, date, banque ou pointed
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

// Helpers de matching pour l'import (réconciliation avec les ops existantes).

// Clé d'égalité stricte (dédup d'imports successifs).
const exactKey = (label, bankId, amount, date) =>
  `${label}|${bankId}|${amount}|${new Date(date).toISOString().slice(0, 10)}`;

// Suffixe le libellé existant par "(libelléFichier)". On ne ré-applique pas le
// suffixe s'il y figure déjà (idempotent en cas de re-réconciliation), et on
// ne suffixe pas si les libellés sont déjà identiques (le suffixe serait redondant).
function appendImportLabel(currentLabel, importedLabel) {
  if (!importedLabel) return currentLabel;
  if (currentLabel === importedLabel) return currentLabel;
  const suffix = ` (${importedLabel})`;
  if (currentLabel.endsWith(suffix)) return currentLabel;
  return currentLabel + suffix;
}

// Normalise bankId d'une opération (Mongo populé OU ID brut SQLite).
const bankIdOf = (op) =>
  op.bankId && op.bankId._id ? String(op.bankId._id) : String(op.bankId);

// POST /api/operations/import  (multipart/form-data)
//   fields: file (.qif, .ofx ou .zip), bankId
//
// Importe les opérations d'un relevé bancaire et tente de réconcilier chaque
// ligne avec une opération existante (typiquement un prévisionnel non pointé) :
//
//   - Si une ligne existe déjà à l'identique (label|bankId|amount|date)    → ignorée (doublon)
//   - Si elle a déjà été réconciliée (suffixe "(label)" sur une op pointée)→ ignorée (doublon)
//   - Sinon, on cherche les ops non pointées de la même banque + même montant.
//     Parmi ces candidats, on prend le meilleur match de libellé (similarité ≥
//     SIMILARITY_THRESHOLD via labelSimilarity) :
//       * Match trouvé → réconciliation auto (l'existant devient pointé,
//                        son label est suffixé par " (labelFichier)")
//       * Aucun match  → l'opération est créée (pointée, label brut, catégorie
//                        inférée à partir d'opérations existantes au libellé proche)
//
// La banque cible doit appartenir à l'utilisateur ; l'algorithme reste scopé à userId.
router.post('/import', (req, res, next) => {
  importUpload.single('file')(req, res, (err) => err ? next(err) : next());
}, wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Fichier requis (champ "file")' });
  const { bankId } = req.body;
  if (!bankId) return res.status(400).json({ message: 'bankId requis' });

  const { operations, banks } = req.app.locals.db;
  const userId = req.user._id;

  const bank = await banks.findById(bankId, userId);
  if (!bank) return res.status(404).json({ message: 'Banque introuvable' });

  // Parsing — QIF ou OFX uniquement (CSV retiré).
  const { buffer, format } = extractImportPayload(req.file);
  const parser = format === 'qif' ? parseBankQif : parseBankOfx;
  const { rows, invalid } = parser(buffer);

  const existing = await operations.findAllMinimal(userId);

  // Clé numérique du montant : on arrondit au centime pour absorber les écarts
  // IEEE 754 (ex. -210.4 vs -210.40 décodés différemment selon le format).
  const amountKey = (a) => Math.round(Number(a) * 100);

  // Index : exactKey(label|bank|amount|date) pour la dédup stricte
  const existingKeys = new Set(
    existing.map((o) => exactKey(o.label, bankIdOf(o), amountKey(o.amount), o.date)),
  );

  // Index par (bankId, amount centimes) → liste d'ops candidates
  const byBankAmount = new Map();
  for (const o of existing) {
    const k = `${bankIdOf(o)}|${amountKey(o.amount)}`;
    if (!byBankAmount.has(k)) byBankAmount.set(k, []);
    byBankAmount.get(k).push(o);
  }

  // Ops déjà consommées en auto-réconciliation pendant ce batch (pour qu'une
  // 2e ligne du fichier au même montant ne réconcilie pas la même cible).
  const consumed = new Set();

  const toInsert = [];        // nouvelles ops à insérer (pointées)
  const toReconcile = [];     // [{ id, newLabel }] mises à jour atomiques
  const pendingMatches = [];  // [{ importedRow, candidates }] résolutions manuelles
  let duplicates = 0;

  for (const r of rows) {
    const k = `${String(bankId)}|${amountKey(r.amount)}`;
    const sameAmount = byBankAmount.get(k) || [];

    // 1. doublon strict (réimport du même fichier)
    if (existingKeys.has(exactKey(r.label, String(bankId), amountKey(r.amount), r.date))) {
      duplicates++; continue;
    }
    // 2. réconcilié précédemment : op pointée dont le label inclut " (labelFichier)"
    const reconciledMarker = ` (${r.label})`;
    if (sameAmount.some((o) => o.pointed && typeof o.label === 'string' && o.label.endsWith(reconciledMarker))) {
      duplicates++; continue;
    }

    // 3. Candidats à la réconciliation : non pointés, non encore consommés ce batch.
    //    Parmi eux, on cherche le meilleur match par similarité de libellé.
    //    - Si une op existante a le même montant ET un libellé suffisamment proche
    //      (≥ SIMILARITY_THRESHOLD) → auto-réconciliation
    //    - Sinon → insertion comme nouvelle opération (même s'il y a des candidats
    //      au montant identique mais au libellé sans rapport)
    const candidates = sameAmount.filter(
      (o) => !o.pointed && !consumed.has(String(o._id)),
    );
    const target = bestSimilarCandidate(candidates, r.label);

    if (target) {
      consumed.add(String(target._id));
      toReconcile.push({
        id: String(target._id),
        newLabel: appendImportLabel(target.label, r.label),
      });
    } else {
      toInsert.push({
        label: r.label, amount: r.amount, date: r.date,
        bankId, userId, pointed: true,
        category: inferCategory(existing, r.label),
      });
      existingKeys.add(exactKey(r.label, String(bankId), amountKey(r.amount), r.date));
    }
  }

  // Application
  if (toInsert.length) await operations.insertMany(toInsert);
  for (const r of toReconcile) {
    await operations.update(r.id, userId, { pointed: true, label: r.newLabel });
  }

  res.json({
    imported: toInsert.length,
    autoReconciled: toReconcile.length,
    duplicates,
    invalid,
    pendingMatches,
    // Diagnostic temporaire — à retirer une fois la feature stabilisée.
    _debug: {
      rowsParsed: rows.length,
      existingTotal: existing.length,
      existingForThisBank: existing.filter((o) => bankIdOf(o) === String(bankId)).length,
      existingNonPointedForThisBank: existing.filter(
        (o) => bankIdOf(o) === String(bankId) && !o.pointed,
      ).length,
      bankIdSent: String(bankId),
      // Échantillon de 3 ops existantes pour cette banque (clés de matching)
      sampleExistingForBank: existing
        .filter((o) => bankIdOf(o) === String(bankId))
        .slice(0, 3)
        .map((o) => ({
          label: o.label,
          amount: o.amount,
          amountKey: amountKey(o.amount),
          date: o.date,
          pointed: !!o.pointed,
        })),
      // Échantillon de 3 lignes parsées du fichier
      sampleRows: rows.slice(0, 3).map((r) => ({
        label: r.label,
        amount: r.amount,
        amountKey: amountKey(r.amount),
        date: r.date,
      })),
    },
  });
}));

// POST /api/operations/import/resolve
//   body: { resolutions: [{ importedRow, selectedOpIds }] }
//
// Finalise les résolutions des conflits N-candidats remontés par /import :
//   - selectedOpIds vide → on crée la ligne du fichier telle quelle (pointée, label brut)
//   - selectedOpIds non vide → chaque op sélectionnée devient pointée, son label
//     est suffixé par " (importedRow.label)"
//
// La validation passe par userId (toutes les updates filtrent dessus) pour qu'un
// attaquant ne puisse pas pointer/labelliser l'op d'un autre utilisateur.
router.post('/import/resolve', wrap(async (req, res) => {
  const { resolutions } = req.body || {};
  if (!Array.isArray(resolutions)) {
    return res.status(400).json({ message: 'resolutions[] requis' });
  }
  const { operations } = req.app.locals.db;
  const userId = req.user._id;

  const existing = await operations.findAllMinimal(userId);

  const toInsert = [];
  let reconciled = 0;

  for (const r of resolutions) {
    const row = r && r.importedRow;
    const ids = Array.isArray(r && r.selectedOpIds) ? r.selectedOpIds : [];
    if (!row || typeof row.label !== 'string' || typeof row.amount !== 'number'
        || !row.date || !row.bankId) {
      return res.status(400).json({ message: 'résolution invalide (importedRow incomplet)' });
    }
    if (ids.length === 0) {
      toInsert.push({
        label: row.label,
        amount: row.amount,
        date: new Date(row.date),
        bankId: row.bankId,
        userId,
        pointed: true,
        category: inferCategory(existing, row.label),
      });
    } else {
      for (const opId of ids) {
        const cur = await operations.findById(opId, userId);
        if (!cur) continue; // ignoré silencieusement (op supprimée/inaccessible)
        await operations.update(opId, userId, {
          pointed: true,
          label: appendImportLabel(cur.label, row.label),
        });
        reconciled++;
      }
    }
  }

  if (toInsert.length) await operations.insertMany(toInsert);

  res.json({ imported: toInsert.length, reconciled });
}));

module.exports = router;

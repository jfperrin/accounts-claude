const AdmZip = require('adm-zip');
const { parseBankQif } = require('../utils/parseQif');
const { parseBankOfx } = require('../utils/parseOfx');
const { labelSimilarity } = require('../utils/labelSimilarity');
const { buildTokenIndex, findCandidates } = require('../utils/tokenIndex');

const SIMILARITY_THRESHOLD = 0.7;

// Fenêtre de jours autour de la date d'une ligne importée pour considérer
// une opération existante comme candidate à la réconciliation. Évite qu'un
// loyer de janvier (même banque + même montant, non pointé) soit consommé
// par un import de mars. ±15 jours absorbe les décalages de jour banque
// (salaire prévu le 31 → posté le 1er du mois suivant) sans déborder sur
// le mois d'avant ou d'après.
const DATE_WINDOW_DAYS = 15;
const DATE_WINDOW_MS = DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Tolérance relative sur le montant pour la réconciliation. Un loyer estimé à
// 800 € peut être encaissé à 805 € selon les frais : on accepte ±10 % autour
// du montant du fichier importé. Le signe doit rester identique (un débit ne
// matche jamais un crédit).
const AMOUNT_TOLERANCE = 0.10;

function withinDateWindow(opDate, rowDate) {
  return Math.abs(new Date(opDate).getTime() - new Date(rowDate).getTime()) <= DATE_WINDOW_MS;
}

function withinAmountTolerance(opAmount, rowAmount) {
  if (Math.sign(opAmount) !== Math.sign(rowAmount)) return false;
  if (rowAmount === 0) return opAmount === 0;
  return Math.abs(opAmount - rowAmount) <= Math.abs(rowAmount) * AMOUNT_TOLERANCE;
}

// Normalise bankId d'une opération (Mongo populé OU ID brut SQLite).
const bankIdOf = (op) =>
  op.bankId && op.bankId._id ? String(op.bankId._id) : String(op.bankId);

// Clé d'égalité stricte (dédup d'imports successifs).
const exactKey = (label, bankId, amount, date) =>
  `${label}|${bankId}|${amount}|${new Date(date).toISOString().slice(0, 10)}`;

// Clé numérique du montant arrondi au centime (absorbe les écarts IEEE 754).
const amountKey = (a) => Math.round(Number(a) * 100);

// Suffixe le libellé existant par "(libelléFichier)". Idempotent.
function appendImportLabel(currentLabel, importedLabel) {
  if (!importedLabel) return currentLabel;
  if (currentLabel === importedLabel) return currentLabel;
  const suffix = ` (${importedLabel})`;
  if (currentLabel.endsWith(suffix)) return currentLabel;
  return currentLabel + suffix;
}

// Cherche le categoryId d'un hint dont le libellé est similaire à `label`
// à au moins SIMILARITY_THRESHOLD. Utilise un index inversé par tokens pour
// ne calculer la similarité que sur les hints partageant au moins un token
// avec `label` (au lieu de scanner toute la liste).
function inferCategoryFromHints(hints, tokenIndex, label) {
  const candidates = findCandidates(tokenIndex, label);
  let best = null;
  let bestScore = SIMILARITY_THRESHOLD - Number.EPSILON;
  for (const h of candidates) {
    const score = labelSimilarity(h.label, label);
    if (score > bestScore) {
      bestScore = score;
      best = h.categoryId;
      if (score === 1) break;
    }
  }
  return best ? String(best) : null;
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

// Détermine le format d'import à partir d'un nom de fichier.
function formatFromName(name) {
  if (/\.qif$/i.test(name)) return 'qif';
  if (/\.ofx$/i.test(name)) return 'ofx';
  return null;
}

// Extrait le contenu à parser depuis le fichier uploadé.
// Pour un ZIP, prend la première entrée valide en ignorant les résidus macOS.
function extractImportPayload(file) {
  const directFormat = formatFromName(file.originalname);
  if (directFormat) return { buffer: file.buffer, format: directFormat };

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
  const err = new Error("Aucun .qif ou .ofx trouvé dans l'archive");
  err.status = 400;
  throw err;
}

/**
 * Traite un fichier importé (QIF/OFX/ZIP).
 * @param {object} file - fichier multer (buffer + originalname)
 * @param {string} bankId
 * @param {string} userId
 * @param {object} db - req.app.locals.db
 * @returns {{ imported, autoReconciled, duplicates, invalid, pendingMatches, _debug }}
 */
// Charge les category_hints de l'utilisateur. Lazy init au 1er import :
// si la table est vide, on rebuild depuis l'historique des opérations.
async function loadHints(categoryHints, userId) {
  let hints = await categoryHints.findByUser(userId);
  if (hints.length === 0) {
    await categoryHints.rebuildFromOperations(userId);
    hints = await categoryHints.findByUser(userId);
  }
  return hints;
}

async function processImportFile(file, bankId, userId, db) {
  const { operations, banks, categoryHints } = db;

  const bank = await banks.findById(bankId, userId);
  if (!bank) {
    const err = new Error('Banque introuvable');
    err.status = 404;
    throw err;
  }

  const { buffer, format } = extractImportPayload(file);
  const parser = format === 'qif' ? parseBankQif : parseBankOfx;
  const { rows, invalid } = parser(buffer);

  const existing = await operations.findAllMinimal(userId);

  const existingKeys = new Set(
    existing.map((o) => exactKey(o.label, bankIdOf(o), amountKey(o.amount), o.date)),
  );

  // Index par banque uniquement : on filtrera ensuite par fenêtre temporelle
  // ET tolérance de montant (le montant n'est plus une clé exacte).
  const byBank = new Map();
  for (const o of existing) {
    const k = bankIdOf(o);
    if (!byBank.has(k)) byBank.set(k, []);
    byBank.get(k).push(o);
  }

  // Hints + index inversé : remplace le scan O(N) par bucket lookup
  const hints = await loadHints(categoryHints, userId);
  const tokenIndex = buildTokenIndex(hints, (h) => h.label);

  const consumed = new Set();
  const toInsert = [];
  const toReconcile = [];
  const pendingMatches = [];
  const newHints = []; // hints à upsert après l'import (lib importée → catégorie inférée)
  let duplicates = 0;

  for (const r of rows) {
    const sameBank = byBank.get(String(bankId)) || [];
    // Candidats à la réconciliation : même banque, montant dans la fourchette
    // ±AMOUNT_TOLERANCE et date dans la fenêtre ±DATE_WINDOW_DAYS.
    const sameAmountNear = sameBank.filter((o) =>
      withinAmountTolerance(o.amount, r.amount) && withinDateWindow(o.date, r.date),
    );

    if (existingKeys.has(exactKey(r.label, String(bankId), amountKey(r.amount), r.date))) {
      duplicates++; continue;
    }
    const reconciledMarker = ` (${r.label})`;
    if (sameAmountNear.some((o) => o.pointed && typeof o.label === 'string' && o.label.endsWith(reconciledMarker))) {
      duplicates++; continue;
    }

    const candidates = sameAmountNear.filter((o) => !o.pointed && !consumed.has(String(o._id)));
    const target = bestSimilarCandidate(candidates, r.label);

    if (target) {
      consumed.add(String(target._id));
      // Le montant du fichier fait foi : il écrase le montant pré-saisi
      // (récurrente, op manuelle approximative, etc.).
      toReconcile.push({
        id: String(target._id),
        newLabel: appendImportLabel(target.label, r.label),
        newAmount: r.amount,
      });
    } else {
      const categoryId = inferCategoryFromHints(hints, tokenIndex, r.label);
      toInsert.push({
        label: r.label, amount: r.amount, date: r.date,
        bankId, userId, pointed: true,
        categoryId,
      });
      existingKeys.add(exactKey(r.label, String(bankId), amountKey(r.amount), r.date));
      // On enrichit le cache avec le libellé importé pour les imports futurs
      if (categoryId) newHints.push({ label: r.label, categoryId });
    }
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  for (const r of toReconcile) {
    await operations.update(r.id, userId, { pointed: true, label: r.newLabel, amount: r.newAmount });
  }
  for (const h of newHints) {
    await categoryHints.upsert(userId, h.label, h.categoryId);
  }

  return {
    imported: toInsert.length,
    autoReconciled: toReconcile.length,
    duplicates,
    invalid,
    pendingMatches,
  };
}

/**
 * Finalise les conflits d'import en attente.
 * @param {Array} resolutions - [{ importedRow, selectedOpIds }]
 * @param {string} userId
 * @param {object} db - req.app.locals.db
 * @returns {{ imported, reconciled }}
 */
async function resolveImportMatches(resolutions, userId, db) {
  const { operations, categoryHints } = db;
  const hints = await loadHints(categoryHints, userId);
  const tokenIndex = buildTokenIndex(hints, (h) => h.label);
  const toInsert = [];
  const newHints = [];
  let reconciled = 0;

  for (const r of resolutions) {
    const row = r && r.importedRow;
    const ids = Array.isArray(r && r.selectedOpIds) ? r.selectedOpIds : [];
    if (!row || typeof row.label !== 'string' || typeof row.amount !== 'number'
        || !row.date || !row.bankId) {
      const err = new Error('résolution invalide (importedRow incomplet)');
      err.status = 400;
      throw err;
    }
    if (ids.length === 0) {
      const categoryId = inferCategoryFromHints(hints, tokenIndex, row.label);
      toInsert.push({
        label: row.label,
        amount: row.amount,
        date: new Date(row.date),
        bankId: row.bankId,
        userId,
        pointed: true,
        categoryId,
      });
      if (categoryId) newHints.push({ label: row.label, categoryId });
    } else {
      for (const opId of ids) {
        const cur = await operations.findById(opId, userId);
        if (!cur) continue;
        // Le montant du fichier fait foi (cf. processImportFile)
        await operations.update(opId, userId, {
          pointed: true,
          label: appendImportLabel(cur.label, row.label),
          amount: row.amount,
        });
        reconciled++;
      }
    }
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  for (const h of newHints) {
    await categoryHints.upsert(userId, h.label, h.categoryId);
  }
  return { imported: toInsert.length, reconciled };
}

module.exports = { processImportFile, resolveImportMatches };

const AdmZip = require('adm-zip');
const { parseBankQif } = require('../utils/parseQif');
const { parseBankOfx } = require('../utils/parseOfx');
const { labelSimilarity } = require('../utils/labelSimilarity');

const SIMILARITY_THRESHOLD = 0.7;

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
async function processImportFile(file, bankId, userId, db) {
  const { operations, banks } = db;

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

  const byBankAmount = new Map();
  for (const o of existing) {
    const k = `${bankIdOf(o)}|${amountKey(o.amount)}`;
    if (!byBankAmount.has(k)) byBankAmount.set(k, []);
    byBankAmount.get(k).push(o);
  }

  const consumed = new Set();
  const toInsert = [];
  const toReconcile = [];
  const pendingMatches = [];
  let duplicates = 0;

  for (const r of rows) {
    const k = `${String(bankId)}|${amountKey(r.amount)}`;
    const sameAmount = byBankAmount.get(k) || [];

    if (existingKeys.has(exactKey(r.label, String(bankId), amountKey(r.amount), r.date))) {
      duplicates++; continue;
    }
    const reconciledMarker = ` (${r.label})`;
    if (sameAmount.some((o) => o.pointed && typeof o.label === 'string' && o.label.endsWith(reconciledMarker))) {
      duplicates++; continue;
    }

    const candidates = sameAmount.filter((o) => !o.pointed && !consumed.has(String(o._id)));
    const target = bestSimilarCandidate(candidates, r.label);

    if (target) {
      consumed.add(String(target._id));
      toReconcile.push({ id: String(target._id), newLabel: appendImportLabel(target.label, r.label) });
    } else {
      toInsert.push({
        label: r.label, amount: r.amount, date: r.date,
        bankId, userId, pointed: true,
        category: inferCategory(existing, r.label),
      });
      existingKeys.add(exactKey(r.label, String(bankId), amountKey(r.amount), r.date));
    }
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  for (const r of toReconcile) {
    await operations.update(r.id, userId, { pointed: true, label: r.newLabel });
  }

  return {
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
      sampleExistingForBank: existing
        .filter((o) => bankIdOf(o) === String(bankId))
        .slice(0, 3)
        .map((o) => ({ label: o.label, amount: o.amount, amountKey: amountKey(o.amount), date: o.date, pointed: !!o.pointed })),
      sampleRows: rows.slice(0, 3).map((r) => ({ label: r.label, amount: r.amount, amountKey: amountKey(r.amount), date: r.date })),
    },
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
  const { operations } = db;
  const existing = await operations.findAllMinimal(userId);
  const toInsert = [];
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
        if (!cur) continue;
        await operations.update(opId, userId, {
          pointed: true,
          label: appendImportLabel(cur.label, row.label),
        });
        reconciled++;
      }
    }
  }

  if (toInsert.length) await operations.insertMany(toInsert);
  return { imported: toInsert.length, reconciled };
}

module.exports = { processImportFile, resolveImportMatches };

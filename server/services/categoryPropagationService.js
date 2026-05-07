// Trouve les opérations sans catégorie au libellé similaire à une opération source.
// Pure : prend tous les ops, renvoie un sous-ensemble. Testable sans base.

const { labelSimilarity } = require('../utils/labelSimilarity');

const SIMILARITY_THRESHOLD = 0.7;
const WINDOW_MONTHS = 3;

const bankIdOf = (op) => {
  const b = op.bankId;
  if (!b) return null;
  if (typeof b === 'string') return b;
  if (b._id) return String(b._id);
  return String(b);
};

function shiftMonths(date, delta) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, d.getUTCDate()));
}

// Renvoie les opérations sans catégorie (et différentes de la source) appartenant
// à la même banque que la source, dont le libellé est similaire (≥ seuil) et
// dont la date est dans une fenêtre de ±WINDOW_MONTHS autour de la date de référence
// (date de l'op source, ou "maintenant" si non fournie).
function findSimilarUncategorized(allOps, sourceLabel, sourceBankId, sourceOpId, referenceDate) {
  const targetBankId = String(sourceBankId);
  const sourceId = sourceOpId != null ? String(sourceOpId) : null;
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const minDate = shiftMonths(ref, -WINDOW_MONTHS);
  const maxDate = shiftMonths(ref, WINDOW_MONTHS);
  const matches = [];
  for (const op of allOps) {
    if (sourceId && String(op._id) === sourceId) continue;
    if (op.categoryId) continue;
    if (bankIdOf(op) !== targetBankId) continue;
    const d = new Date(op.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d < minDate || d > maxDate) continue;
    if (labelSimilarity(op.label, sourceLabel) >= SIMILARITY_THRESHOLD) {
      matches.push(op);
    }
  }
  return matches;
}

// Variante pour le cas "changement de catégorie d'une op déjà catégorisée" :
// retourne les opérations similaires (même banque + libellé proche + fenêtre
// temporelle) qui ne sont PAS déjà dans la catégorie cible. Inclut donc à la
// fois les ops sans catégorie et celles dans une autre catégorie — utile pour
// proposer une re-catégorisation en lot quand l'utilisateur consolide ses
// libellés sous une nouvelle catégorie.
function findSimilarExcludingCategory(allOps, sourceLabel, sourceBankId, sourceOpId, referenceDate, excludeCategoryId) {
  const targetBankId = String(sourceBankId);
  const sourceId = sourceOpId != null ? String(sourceOpId) : null;
  const excludeId = excludeCategoryId ? String(excludeCategoryId) : null;
  const ref = referenceDate ? new Date(referenceDate) : new Date();
  const minDate = shiftMonths(ref, -WINDOW_MONTHS);
  const maxDate = shiftMonths(ref, WINDOW_MONTHS);
  const matches = [];
  for (const op of allOps) {
    if (sourceId && String(op._id) === sourceId) continue;
    const opCatId = op.categoryId ? String(op.categoryId?._id ?? op.categoryId) : null;
    if (excludeId && opCatId === excludeId) continue;
    if (bankIdOf(op) !== targetBankId) continue;
    const d = new Date(op.date);
    if (Number.isNaN(d.getTime())) continue;
    if (d < minDate || d > maxDate) continue;
    if (labelSimilarity(op.label, sourceLabel) >= SIMILARITY_THRESHOLD) {
      matches.push(op);
    }
  }
  return matches;
}

module.exports = {
  findSimilarUncategorized,
  findSimilarExcludingCategory,
  SIMILARITY_THRESHOLD,
  WINDOW_MONTHS,
};

// Trouve les opérations sans catégorie au libellé similaire à une opération source.
// Pure : prend tous les ops, renvoie un sous-ensemble. Testable sans base.

const { labelSimilarity } = require('../utils/labelSimilarity');

const SIMILARITY_THRESHOLD = 0.7;

const bankIdOf = (op) => {
  const b = op.bankId;
  if (!b) return null;
  if (typeof b === 'string') return b;
  if (b._id) return String(b._id);
  return String(b);
};

// Renvoie les opérations sans catégorie (et différentes de la source) appartenant
// à la même banque que la source dont le libellé est similaire (≥ seuil).
function findSimilarUncategorized(allOps, sourceLabel, sourceBankId, sourceOpId) {
  const targetBankId = String(sourceBankId);
  const sourceId = sourceOpId != null ? String(sourceOpId) : null;
  const matches = [];
  for (const op of allOps) {
    if (sourceId && String(op._id) === sourceId) continue;
    if (op.categoryId) continue;
    if (bankIdOf(op) !== targetBankId) continue;
    if (labelSimilarity(op.label, sourceLabel) >= SIMILARITY_THRESHOLD) {
      matches.push(op);
    }
  }
  return matches;
}

module.exports = { findSimilarUncategorized, SIMILARITY_THRESHOLD };

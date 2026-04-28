// Index inversé token → items pour accélérer la recherche par similarité.
// Au lieu de comparer un libellé contre tous les items (O(N)), on récupère
// d'abord la liste des items partageant au moins un token significatif avec
// le libellé cherché, puis on calcule la similarité uniquement sur ce sous-ensemble.
//
// Utilisé par l'import : on indexe les category_hints, puis pour chaque ligne
// du fichier on extrait les candidats du même bucket avant le calcul fin.

const { tokenize } = require('./labelSimilarity');

/**
 * Construit une Map<token, item[]> à partir d'une liste d'items.
 * Chaque item est référencé sous chacun de ses tokens significatifs.
 * @param {Array} items
 * @param {(item: any) => string} getLabel
 * @returns {Map<string, Array>}
 */
function buildTokenIndex(items, getLabel) {
  const index = new Map();
  for (const item of items) {
    const tokens = tokenize(getLabel(item));
    for (const t of tokens) {
      let bucket = index.get(t);
      if (!bucket) {
        bucket = [];
        index.set(t, bucket);
      }
      bucket.push(item);
    }
  }
  return index;
}

/**
 * Retourne les items partageant au moins un token avec `label`. Dédupliqué.
 * Si `label` n'a aucun token significatif (libellé très court), retourne [].
 * @param {Map<string, Array>} index
 * @param {string} label
 * @returns {Array}
 */
function findCandidates(index, label) {
  const tokens = tokenize(label);
  if (tokens.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    const bucket = index.get(t);
    if (!bucket) continue;
    for (const item of bucket) {
      if (seen.has(item)) continue;
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

module.exports = { buildTokenIndex, findCandidates };

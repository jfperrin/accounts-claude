// Mesure la similarité entre deux libellés bancaires.
// Combine deux métriques complémentaires :
//
//  1. Token overlap (mots significatifs communs) :
//     |intersection(ta, tb)| / min(|ta|, |tb|)
//     → "carte 23 0 4 sauvegarde" ≈ "carte 25 0 4 sauvegarde"
//       tokens : {"carte","sauvegarde"} vs {"carte","sauvegarde"} → 1.0
//     → "échéance de crédit" ≈ "échéance 2029 lion de crédit"
//       tokens : {"echeance","credit"} vs {"echeance","lion","credit"} → 2/2 = 1.0
//
//  2. Similarité trigramme (coefficient de Dice sur les trigrammes de caractères) :
//     fallback quand les libellés sont trop courts / mono-token.
//
// La fonction retourne max(tokenOverlap, trigramSim) ∈ [0, 1].
// Seuil recommandé pour l'auto-affectation de catégories : 0.8.

// Normalise : minuscules, supprime les accents, remplace tout ce qui n'est pas
// alphanumérique par un espace, écrase les espaces multiples.
function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')       // supprime les diacritiques (accents, cédilles…)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Retourne les tokens significatifs : au moins 3 caractères ET non purement numériques.
// On ignore les tokens courts ("de", "la", "au") et les codes numériques variables
// (numéros de carte, dates, montants intégrés dans le libellé).
function significantTokens(normalized) {
  return normalized
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

// Trigrammes d'une chaîne normalisée (padded pour capturer le début et la fin).
function trigrams(normalized) {
  const padded = `  ${normalized}  `;
  const set = new Set();
  for (let i = 0; i <= padded.length - 3; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

// Coefficient de Dice sur les trigrammes : 2|A∩B| / (|A|+|B|)
function trigramSim(na, nb) {
  const ta = trigrams(na);
  const tb = trigrams(nb);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) {
    if (tb.has(t)) common++;
  }
  return (2 * common) / (ta.size + tb.size);
}

// Token overlap : fraction des tokens significatifs de la chaîne la plus courte
// qui apparaissent dans la chaîne la plus longue.
// Cas particulier 1 token : très courant pour les libellés saisis manuellement
// (ex. "Loyer") opposés aux libellés bancaires détaillés ("PRLV LOYER MARS").
// Si le token unique est présent dans l'autre liste, on considère que c'est
// une correspondance forte (1.0). Sinon, on retombe sur la similarité trigramme.
function tokenOverlapSim(na, nb) {
  const ta = significantTokens(na);
  const tb = significantTokens(nb);
  if (ta.length === 0 || tb.length === 0) return 0;
  if (ta.length === 1 || tb.length === 1) {
    const [single, other] = ta.length === 1 ? [ta[0], tb] : [tb[0], ta];
    return other.includes(single) ? 1 : 0;
  }
  const setB = new Set(tb);
  const common = ta.filter((t) => setB.has(t)).length;
  return common / Math.min(ta.length, tb.length);
}

/**
 * Retourne un score de similarité entre deux libellés bancaires, entre 0 et 1.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function labelSimilarity(a, b) {
  if (!a || !b) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  return Math.max(tokenOverlapSim(na, nb), trigramSim(na, nb));
}

// Tokens significatifs d'un libellé brut (combine normalize + significantTokens).
// Exposé pour permettre la construction d'index inversés (cf. utils/tokenIndex.js).
function tokenize(label) {
  if (!label) return [];
  return significantTokens(normalize(label));
}

module.exports = { labelSimilarity, tokenize };

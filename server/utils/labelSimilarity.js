// Mesure la similarité entre deux libellés bancaires.
// Combine deux métriques complémentaires :
//
//  1. Token overlap : Dice sur les tokens **discriminants** (significatifs hors
//     mots génériques bancaires comme "carte", "virement", "prlv"…). Avec un
//     shortcut mono-token pour les libellés saisis manuellement.
//
//  2. Similarité trigramme (coefficient de Dice sur les trigrammes de caractères) :
//     fallback quand les libellés sont trop courts.
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

// Mots génériques omniprésents dans les libellés bancaires français : "carte X X
// SAUVEGARDE", "PRLV EDF", "VIR SALAIRE"… Ils ne discriminent rien : si le seul
// token commun entre deux libellés est un de ceux-là, on ne doit pas conclure
// à une correspondance ("carte 21 0 3" ≠ "carte su 69 lion").
const GENERIC_BANK_TOKENS = new Set([
  'carte', 'cb', 'ecb',
  'paiement', 'pmt', 'paie',
  'achat',
  'virement', 'vir', 'vrt',
  'prelevement', 'prlv',
  'retrait',
  'transfert',
  'tip',
  'cheque', 'chq',
]);

// Retourne les tokens significatifs : au moins 3 caractères ET non purement numériques.
// On ignore les tokens courts ("de", "la", "au") et les codes numériques variables
// (numéros de carte, dates, montants intégrés dans le libellé).
function significantTokens(normalized) {
  return normalized
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t));
}

function meaningfulTokens(tokens) {
  return tokens.filter((t) => !GENERIC_BANK_TOKENS.has(t));
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

// Score basé sur les tokens significatifs.
//
// Cas spécial : libellé saisi manuellement (1 token brut, ex. "Loyer") opposé à
// un libellé bancaire détaillé (ex. "PRLV LOYER MARS"). Si le token unique est
// présent dans l'autre liste, on retourne 1.0. Si c'est un mot générique
// (carte, virement…), 0.
//
// Cas général : coefficient de Dice sur les tokens **discriminants**
// (significatifs hors mots génériques bancaires) : 2|ma∩mb| / (|ma|+|mb|).
// Cette mesure pénalise correctement les libellés qui ne partagent qu'un seul
// mot discriminant alors qu'ils en ont plusieurs ("CARTE SU 69 LYON" vs
// "CARTE GREECE 40 LYON" partagent uniquement "lyon" → 0.67).
function tokenOverlapSim(na, nb) {
  const rawA = na ? na.split(/\s+/).filter(Boolean) : [];
  const rawB = nb ? nb.split(/\s+/).filter(Boolean) : [];
  const ta = significantTokens(na);
  const tb = significantTokens(nb);
  if (ta.length === 0 || tb.length === 0) return 0;

  if (rawA.length === 1 || rawB.length === 1) {
    const single = rawA.length === 1 ? ta[0] : tb[0];
    const other = rawA.length === 1 ? tb : ta;
    if (!single || GENERIC_BANK_TOKENS.has(single)) return 0;
    return other.includes(single) ? 1 : 0;
  }

  const ma = meaningfulTokens(ta);
  const mb = meaningfulTokens(tb);
  if (ma.length === 0 || mb.length === 0) return 0;
  const setMb = new Set(mb);
  const common = ma.filter((t) => setMb.has(t)).length;
  if (common === 0) return 0;
  return (2 * common) / (ma.length + mb.length);
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

// Détection de patterns d'opérations récurrentes dans l'historique.
//
// Une suggestion = groupe d'opérations similaires (même banque, libellés proches,
// montants stables, jour du mois stable) qui n'est pas déjà couvert par un modèle
// récurrent existant.
//
// L'API publique est `detectRecurringSuggestions(operations, recurringTemplates,
// dismissedKeys, opts)` — pure, testable sans base.

const { labelSimilarity } = require('../utils/labelSimilarity');

// Paramètres de détection. Modifier ici pour ajuster la sensibilité.
const DEFAULTS = {
  monthsBack: 12,           // fenêtre d'analyse
  similarityThreshold: 0.7, // pour grouper les libellés
  minOccurrences: 3,        // nombre minimal d'opérations pour suggérer
  minDistinctMonths: 2,     // mois distincts pour éviter "3 fois le même jour"
  amountVariationMax: 0.15, // écart-type / |moyenne| max
  dayDeviationMax: 5,       // jours max d'écart à la médiane
  minAmount: 0.01,          // ignore les groupes de montant ~0
};

const bankIdOf = (op) => {
  const b = op.bankId;
  if (!b) return null;
  if (typeof b === 'string') return b;
  if (b._id) return String(b._id);
  return String(b);
};

const sign = (n) => (n >= 0 ? 1 : -1);

// Distance circulaire entre deux jours-du-mois (période ~30j). Traite
// "30 du mois N-1" et "1er du mois N" comme proches : un prélèvement
// nominalement en début de mois est parfois exécuté le dernier jour du
// mois précédent (week-end, jour férié).
const DAY_PERIOD = 30;
const circDayDist = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, DAY_PERIOD - d);
};

// Médian circulaire : jour-du-mois qui minimise la somme des distances
// circulaires aux jours observés (équivalent d'une médiane sur le cercle Z/30).
// Renvoie aussi le max des distances → comparé au seuil `dayDeviationMax`.
// Remplace l'ancienne approche médiane + distance linéaire qui rejetait les groupes
// dont les occurrences chevauchent une frontière de mois (ex. jours [2,2,5,27,30]).
// Tiebreak sum-then-max : pour [30,2,30,30] on veut « le 30 », pas « le 1er ».
function bestCircularCenter(days) {
  let bestDay = days[0];
  let bestSum = Infinity;
  let bestMaxDev = Infinity;
  for (let d = 1; d <= 31; d++) {
    let sum = 0;
    let maxDev = 0;
    for (const x of days) {
      const dist = circDayDist(x, d);
      sum += dist;
      if (dist > maxDev) maxDev = dist;
    }
    if (sum < bestSum || (sum === bestSum && maxDev < bestMaxDev)) {
      bestSum = sum;
      bestMaxDev = maxDev;
      bestDay = d;
    }
  }
  return { day: bestDay, maxDev: bestMaxDev };
}

const monthKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const dayOf = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCDate();
};

// Normalisation cohérente avec utils/labelSimilarity (minuscule, sans accent,
// alphanumérique uniquement). Sert à construire la clé stable d'une suggestion.
const normalizeForKey = (label) => (label || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Mn}/gu, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// categoryId majoritaire ; à égalité, on prend le plus récent.
function majorityCategoryId(ops) {
  const counts = new Map();
  let latestCat = null;
  let latestTime = -Infinity;
  for (const o of ops) {
    if (!o.categoryId) continue;
    const cid = String(o.categoryId);
    counts.set(cid, (counts.get(cid) || 0) + 1);
    const t = new Date(o.date).getTime();
    if (t > latestTime) { latestTime = t; latestCat = cid; }
  }
  let winner = null;
  let max = 0;
  for (const [cat, c] of counts) {
    if (c > max || (c === max && cat === latestCat)) { max = c; winner = cat; }
  }
  return winner;
}

// Libellé canonique d'un groupe : le plus fréquent, à égalité le plus court.
function canonicalLabel(ops) {
  const counts = new Map();
  for (const o of ops) counts.set(o.label, (counts.get(o.label) || 0) + 1);
  let best = ops[0].label;
  let bestCount = 0;
  for (const [lbl, c] of counts) {
    if (c > bestCount || (c === bestCount && lbl.length < best.length)) {
      best = lbl;
      bestCount = c;
    }
  }
  return best;
}

// Clustering par union-find dans chaque bucket (même bankId + même signe).
// Pour chaque nouvelle opération, on regarde TOUS les membres des clusters
// existants (pas seulement l'exemplaire) et on fusionne au premier match ≥ seuil.
// Robuste aux libellés transitivement similaires : "LOYER MARS" et "LOYER AVRIL"
// peuvent ne pas matcher directement mais "LOYER MAI" peut faire le pont.
function cluster(ops, threshold) {
  const buckets = new Map(); // `${bankId}|${sign}` → clusters[][]
  for (const op of ops) {
    const bId = bankIdOf(op);
    if (!bId) continue;
    const bucketKey = `${bId}|${sign(op.amount)}`;
    let clusters = buckets.get(bucketKey);
    if (!clusters) { clusters = []; buckets.set(bucketKey, clusters); }
    // Trouve tous les clusters dont au moins un membre matche
    const matched = [];
    for (let i = 0; i < clusters.length; i++) {
      if (clusters[i].some((m) => labelSimilarity(m.label, op.label) >= threshold)) {
        matched.push(i);
      }
    }
    if (matched.length === 0) {
      clusters.push([op]);
    } else {
      // Fusionne tous les clusters matchés en un seul, puis ajoute l'opération
      const merged = [op];
      for (const i of matched) merged.push(...clusters[i]);
      // Retire les clusters fusionnés (en partant de la fin pour préserver les index)
      for (let i = matched.length - 1; i >= 0; i--) clusters.splice(matched[i], 1);
      clusters.push(merged);
    }
  }
  return [...buckets.values()].flat();
}

// Coefficient de variation des montants (σ / |μ|). +Infinity si μ ≈ 0.
function amountCV(ops, minAmount) {
  const amts = ops.map((o) => o.amount);
  const mean = amts.reduce((s, x) => s + x, 0) / amts.length;
  if (Math.abs(mean) < minAmount) return Infinity;
  const variance = amts.reduce((s, x) => s + (x - mean) ** 2, 0) / amts.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

// Tente de splitter un cluster en deux sur le plus grand gap de montant
// (avec chaque sous-cluster ≥ minOccurrences). Vise les libellés portant deux
// récurrences distinctes : DGFiP impôt -142€ + prélèvement à la source -18€,
// AFI ESCA -29.41€ + -13.47€, etc.
//
// Accepte le split uniquement si au moins un sous-cluster passe le seuil de cv
// alors que le cluster fusionné ne le passait pas. Évite de fragmenter les
// récurrences naturellement bruitées (montant moyennement variable).
function splitBimodalCluster(group, cfg) {
  if (group.length < cfg.minOccurrences * 2) return [group];
  if (amountCV(group, cfg.minAmount) <= cfg.amountVariationMax) return [group];

  const sorted = [...group].sort((a, b) => a.amount - b.amount);
  let maxGap = -1;
  let splitIdx = -1;
  // Borne le split pour garantir minOccurrences de chaque côté.
  for (let i = cfg.minOccurrences - 1; i <= sorted.length - cfg.minOccurrences - 1; i++) {
    const gap = sorted[i + 1].amount - sorted[i].amount;
    if (gap > maxGap) { maxGap = gap; splitIdx = i; }
  }
  if (splitIdx < 0 || maxGap <= 0) return [group];

  const left = sorted.slice(0, splitIdx + 1);
  const right = sorted.slice(splitIdx + 1);
  const cvLeft = amountCV(left, cfg.minAmount);
  const cvRight = amountCV(right, cfg.minAmount);
  if (cvLeft > cfg.amountVariationMax && cvRight > cfg.amountVariationMax) return [group];
  return [left, right];
}

// Vrai si un modèle récurrent existant couvre déjà ce groupe (même banque,
// libellé similaire, même signe de montant).
function isCoveredByExisting(group, recurringTemplates, threshold) {
  const bId = bankIdOf(group[0]);
  const grpSign = sign(group[0].amount);
  const exemplarLabel = group[0].label;
  return recurringTemplates.some((r) => {
    if (bankIdOf(r) !== bId) return false;
    if (sign(r.amount) !== grpSign) return false;
    return labelSimilarity(r.label, exemplarLabel) >= threshold;
  });
}

function detectRecurringSuggestions(operations, recurringTemplates = [], dismissedKeys = [], opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const now = opts.now ? new Date(opts.now) : new Date();
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - cfg.monthsBack);

  const dismissed = new Set(dismissedKeys);

  // 1. Filtre fenêtre + bankId présent
  const recent = operations.filter((o) => {
    const t = new Date(o.date).getTime();
    return t >= cutoff.getTime() && bankIdOf(o);
  });

  // 2. Clustering : par libellé, puis split bimodal sur les montants pour
  // séparer les récurrences distinctes au même libellé (ex. impôt + PAS).
  const groups = cluster(recent, cfg.similarityThreshold)
    .flatMap((g) => splitBimodalCluster(g, cfg));

  // 3. Évaluation + filtres
  const suggestions = [];
  for (const group of groups) {
    if (group.length < cfg.minOccurrences) continue;

    const months = new Set(group.map((o) => monthKey(o.date)));
    if (months.size < cfg.minDistinctMonths) continue;

    const amounts = group.map((o) => o.amount);
    const mean = amounts.reduce((s, x) => s + x, 0) / amounts.length;
    if (Math.abs(mean) < cfg.minAmount) continue;
    const variance = amounts.reduce((s, x) => s + (x - mean) ** 2, 0) / amounts.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / Math.abs(mean);
    if (cv > cfg.amountVariationMax) continue;

    const days = group.map((o) => dayOf(o.date));
    const { day: medDay, maxDev } = bestCircularCenter(days);
    if (maxDev > cfg.dayDeviationMax) continue;

    if (isCoveredByExisting(group, recurringTemplates, cfg.similarityThreshold)) continue;

    const label = canonicalLabel(group);
    const bId = bankIdOf(group[0]);
    const roundedAmount = Math.round(mean * 100) / 100;
    // Le montant fait partie de la clé : un même libellé peut donner deux
    // suggestions distinctes après split bimodal (ex. impôt -142€ et -18€) qui
    // doivent pouvoir être ignorées indépendamment.
    const key = `${bId}|${normalizeForKey(label)}|${roundedAmount}`;
    if (dismissed.has(key)) continue;

    suggestions.push({
      key,
      label,
      amount: roundedAmount,
      dayOfMonth: medDay,
      bankId: bId,
      categoryId: majorityCategoryId(group),
      occurrences: group
        .map((o) => ({ _id: o._id, label: o.label, amount: o.amount, date: o.date }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
      // Score : plus d'occurrences + amplitude de variation faible = mieux.
      confidence: group.length * (1 - cv),
    });
  }

  // 4. Tri : meilleur score d'abord
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}

module.exports = { detectRecurringSuggestions, DEFAULTS };

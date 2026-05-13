// Détection de paires d'opérations qui pourraient être les deux jambes d'un
// virement interbanque (transferId à attribuer après confirmation utilisateur).
//
// Critères stricts :
//   - banques différentes
//   - aucun transferId actuellement (on ne ré-apparie pas une op déjà liée)
//   - montants exactement opposés au centime près (un débit -X face à un crédit +X)
//   - dates dans une fenêtre de TRANSFER_DATE_WINDOW_DAYS jours
//
// Score de confiance pour le tri (1.0 = très probable) :
//   +0.5 si même jour, dégradé linéairement jusqu'à 0 à TRANSFER_DATE_WINDOW_DAYS
//   +0.3 si le libellé contient un mot clef de virement (VIR/VIREMENT/TRANSFERT/PRLV INTERNE)
//   +0.2 si le libellé contient le nom de l'autre banque (insensible casse/accents)
//
// La fonction est pure : pas d'I/O, pas d'effet de bord, testable unitairement.

const TRANSFER_DATE_WINDOW_DAYS = 5;
const TRANSFER_DATE_WINDOW_MS = TRANSFER_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const TRANSFER_KEYWORDS = /\b(vir(?:ement)?|vrt|transfert|prlv\s*interne)\b/i;

// Clé numérique du montant en centimes (absorbe les écarts IEEE 754).
const cents = (n) => Math.round(Number(n) * 100);

function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '');
}

function bankIdOf(op) {
  return op.bankId && op.bankId._id ? String(op.bankId._id) : String(op.bankId);
}

function timeOf(op) {
  return new Date(op.date).getTime();
}

function scorePair(opA, opB, banks) {
  const dt = Math.abs(timeOf(opA) - timeOf(opB));
  const dateScore = 0.5 * Math.max(0, 1 - dt / TRANSFER_DATE_WINDOW_MS);

  const labelA = normalize(opA.label);
  const labelB = normalize(opB.label);
  const kw = TRANSFER_KEYWORDS.test(labelA) || TRANSFER_KEYWORDS.test(labelB) ? 0.3 : 0;

  const bankAId = bankIdOf(opA);
  const bankBId = bankIdOf(opB);
  const bankA = banks.get(bankAId);
  const bankB = banks.get(bankBId);
  const nameA = bankA ? normalize(bankA.label) : '';
  const nameB = bankB ? normalize(bankB.label) : '';
  const nameMatch = (nameB && labelA.includes(nameB)) || (nameA && labelB.includes(nameA));
  const bankScore = nameMatch ? 0.2 : 0;

  return Math.min(1, dateScore + kw + bankScore);
}

/**
 * Retourne les paires d'opérations candidates à être des virements internes.
 * @param {Array} operations - opérations brutes (avec _id, bankId, amount, date, label, transferId)
 * @param {Array} banks - banques de l'utilisateur (pour matcher le nom dans les libellés)
 * @returns {Array<{ outOp, inOp, confidence }>} - paires triées par confiance décroissante
 */
function detectTransferCandidates(operations, banks = []) {
  const eligible = operations.filter((o) => !o.transferId);
  const banksById = new Map(banks.map((b) => [String(b._id), b]));

  // Indexe par montant absolu → on cherche ensuite les paires (négatif, positif)
  // de même montant absolu et de banques différentes.
  const byAbsAmount = new Map();
  for (const o of eligible) {
    const k = Math.abs(cents(o.amount));
    if (!byAbsAmount.has(k)) byAbsAmount.set(k, []);
    byAbsAmount.get(k).push(o);
  }

  const pairs = [];
  const consumed = new Set();

  for (const group of byAbsAmount.values()) {
    if (group.length < 2) continue;
    const debits = group.filter((o) => cents(o.amount) < 0);
    const credits = group.filter((o) => cents(o.amount) > 0);
    if (debits.length === 0 || credits.length === 0) continue;

    // Génère toutes les paires plausibles, score, puis greedy : on prend la
    // meilleure paire, on consomme les deux ops, on recommence sur le reste.
    const candidates = [];
    for (const d of debits) {
      for (const c of credits) {
        if (bankIdOf(d) === bankIdOf(c)) continue;
        const dt = Math.abs(timeOf(d) - timeOf(c));
        if (dt > TRANSFER_DATE_WINDOW_MS) continue;
        candidates.push({ outOp: d, inOp: c, confidence: scorePair(d, c, banksById) });
      }
    }
    candidates.sort((a, b) => b.confidence - a.confidence);
    for (const cand of candidates) {
      const aId = String(cand.outOp._id);
      const bId = String(cand.inOp._id);
      if (consumed.has(aId) || consumed.has(bId)) continue;
      pairs.push(cand);
      consumed.add(aId);
      consumed.add(bId);
    }
  }

  pairs.sort((a, b) => b.confidence - a.confidence);
  return pairs;
}

module.exports = {
  detectTransferCandidates,
  TRANSFER_DATE_WINDOW_DAYS,
};

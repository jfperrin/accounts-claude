import dayjs from 'dayjs';

// Calcul du Hero Horizon : solde projeté en fin du mois sélectionné.
//
// Si monthOffset < 0 → mois passé : on ne projette pas, on renvoie
// `{ pastMonth: true }`. La home affichera un encart sobre.
//
// Sinon (mois courant ou futur) :
//   horizon = actuel
//           + Σ unpointed (date ≤ EOM, hors virements internes)
//           + Σ récurrentes attendues d'ici la fin du mois cible
//             (en évitant celles déjà matérialisées via heuristique
//              sameLabel + même banque + amount à ±10 %).
//
// `operations` doit contenir les ops du mois courant ET des mois entre
// today et endDate (pour la dédup des récurrentes). En pratique, sur la
// home on passe les ops du mois sélectionné — la dédup ne fonctionne donc
// que pour le mois courant ; pour les mois futurs lointains, on accepte
// le risque de double-compte si les ops récurrentes ont été pré-générées.

function sameLabel(opLabel, recLabel) {
  const al = (opLabel || '').toLowerCase().trim();
  const bl = (recLabel || '').toLowerCase().trim();
  if (!al || !bl) return false;
  return al.includes(bl) || bl.includes(al);
}

// Index `Map<"bankId|YYYY-MM", op[]>` pour réduire les recherches O(rec × ops)
// à O(rec × ops_in_même_bank_même_mois). Les virements internes et les ops
// sans date sont filtrés en amont, on ne les recroise plus dans la boucle.
function buildOpsIndex(operations) {
  const idx = new Map();
  for (const o of operations) {
    if (o.transferId) continue;
    if (!o.date) continue;
    const bId = String(o.bankId?._id ?? o.bankId);
    const key = `${bId}|${o.date.slice(0, 7)}`;
    let arr = idx.get(key);
    if (!arr) { arr = []; idx.set(key, arr); }
    arr.push(o);
  }
  return idx;
}

function recurringHasOp(idx, rec, monthStr) {
  const bId = String(rec.bankId?._id ?? rec.bankId);
  const arr = idx.get(`${bId}|${monthStr}`);
  if (!arr) return false;
  for (const o of arr) {
    if (!sameLabel(o.label, rec.label)) continue;
    if (rec.amount && o.amount) {
      if (Math.sign(rec.amount) !== Math.sign(o.amount)) continue;
      if (Math.abs(o.amount - rec.amount) > Math.abs(rec.amount) * 0.10) continue;
    }
    return true;
  }
  return false;
}

export function computeHorizon({
  banks = [],
  unpointed = [],
  recurring = [],
  operations = [],
  monthOffset = 0,
  endDate,
  now = dayjs(),
} = {}) {
  if (monthOffset < 0) {
    return { pastMonth: true };
  }
  if (!endDate) {
    return { pastMonth: false, horizon: 0, actuel: 0, unpointedSum: 0, unpointedCount: 0, recurringRemainingSum: 0, recurringRemainingCount: 0, endDate: null };
  }
  const today = dayjs(now);
  const eom = dayjs(endDate);

  const actuel = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);

  // 1) Unpointed jusqu'à EOM
  const relevantUnpointed = unpointed.filter((o) => {
    if (o.transferId) return false;
    if (!o.date) return false;
    const d = dayjs(o.date);
    return d.isBefore(eom, 'day') || d.isSame(eom, 'day');
  });
  const unpointedSum = relevantUnpointed.reduce((s, o) => s + o.amount, 0);
  const unpointedCount = relevantUnpointed.length;

  // 2) Récurrentes attendues d'ici EOM
  let recurringSum = 0;
  let recurringCount = 0;

  const opsIndex = buildOpsIndex(operations);

  // Mois courant : seuil = today.date() (jours restants à venir).
  const currentMonthStr = today.format('YYYY-MM');
  const dayToday = today.date();
  for (const r of recurring) {
    if (r.toBankId) continue;
    if (r.dayOfMonth <= dayToday) continue;
    if (recurringHasOp(opsIndex, r, currentMonthStr)) continue;
    recurringSum += r.amount;
    recurringCount += 1;
  }

  // Mois futurs (offset > 0) : chaque mois entre courant+1 et sélectionné
  // contribue toutes ses récurrentes (sauf déjà matérialisées).
  for (let i = 1; i <= monthOffset; i++) {
    const mStr = today.add(i, 'month').format('YYYY-MM');
    for (const r of recurring) {
      if (r.toBankId) continue;
      if (recurringHasOp(opsIndex, r, mStr)) continue;
      recurringSum += r.amount;
      recurringCount += 1;
    }
  }

  const horizon = actuel + unpointedSum + recurringSum;

  return {
    pastMonth: false,
    horizon,
    actuel,
    unpointedSum,
    unpointedCount,
    recurringRemainingSum: recurringSum,
    recurringRemainingCount: recurringCount,
    endDate: eom.format('YYYY-MM-DD'),
  };
}

// Sparkline : projection journalière de today à EOM. Cohérent avec horizon :
// le dernier point doit égaler `horizon`.
export function computeHorizonSparkline({
  banks = [],
  unpointed = [],
  recurring = [],
  operations = [],
  endDate,
  now = dayjs(),
} = {}) {
  if (!endDate) return [];
  const today = dayjs(now).startOf('day');
  const eom = dayjs(endDate).startOf('day');
  if (eom.isBefore(today, 'day')) return [];

  const actuel = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
  const totalDays = eom.diff(today, 'day');

  // Impact par jour. Les opérations passées non pointées s'additionnent au
  // jour 0 (elles sont « déjà dues ») pour aligner le départ de la courbe
  // sur la valeur "actuel + retard de pointage".
  const impactByDay = new Map();
  let day0Impact = 0;

  for (const o of unpointed) {
    if (o.transferId) continue;
    if (!o.date) continue;
    const d = dayjs(o.date).startOf('day');
    if (d.isAfter(eom, 'day')) continue;
    if (d.isBefore(today, 'day') || d.isSame(today, 'day')) {
      day0Impact += o.amount;
    } else {
      const k = d.format('YYYY-MM-DD');
      impactByDay.set(k, (impactByDay.get(k) ?? 0) + o.amount);
    }
  }

  // Récurrentes : un point d'impact par mois entre today+1 et eom, au jour
  // r.dayOfMonth. Filtre dédup mensuel via sameLabel.
  const opsIndex = buildOpsIndex(operations);
  for (let i = 0; i <= totalDays; i++) {
    const d = today.add(i, 'day');
    if (d.isSame(today, 'day') || d.isBefore(today, 'day')) continue;
    const monthStr = d.format('YYYY-MM');
    const dom = d.date();
    for (const r of recurring) {
      if (r.toBankId) continue;
      if (r.dayOfMonth !== dom) continue;
      if (recurringHasOp(opsIndex, r, monthStr)) continue;
      const k = d.format('YYYY-MM-DD');
      impactByDay.set(k, (impactByDay.get(k) ?? 0) + r.amount);
    }
  }

  const points = [];
  let running = actuel + day0Impact;
  points.push({ date: today.format('YYYY-MM-DD'), value: running });
  for (let i = 1; i <= totalDays; i++) {
    const d = today.add(i, 'day');
    const k = d.format('YYYY-MM-DD');
    running += impactByDay.get(k) ?? 0;
    points.push({ date: k, value: running });
  }
  return points;
}

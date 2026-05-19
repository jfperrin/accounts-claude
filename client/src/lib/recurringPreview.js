import dayjs from 'dayjs';

// Calcule la liste des récurrentes prévues pour un mois donné qui ne sont
// PAS encore matérialisées dans operations.
//
// Logique alignée sur server/routes/operations.js planRecurring + dédup par
// clé `label|bankId|amount|YYYY-MM-DD`. Permet d'afficher dans la timeline
// les ops à venir sans appeler l'endpoint `/operations/recurring-preview`
// (toutes les données nécessaires sont déjà côté client).
//
// Les virements internes (recurring avec `toBankId`) sont ignorés en v1 :
// ils créent 2 ops liées, à modéliser séparément.
export function computeRecurringPreviews({
  recurring = [],
  operations = [],
  banks = [],
  monthOffset = 0,
  now = dayjs(),
} = {}) {
  const today = dayjs(now);
  const target = today.add(monthOffset, 'month');
  const month = target.month() + 1; // 1-12
  const year = target.year();
  const lastDay = target.endOf('month').date();
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const banksMap = new Map(banks.map((b) => [String(b._id), b.label]));

  // Index des ops existantes pour dédup. La clé exacte ne matche pas toujours
  // les ops importées (suffixe `(rowLabel)` ou montant ajusté à ±10 %), on
  // double avec un index sameLabel + bankId + amount±10%.
  const existingKeys = new Set();
  const existingFuzzy = []; // [{ label, bankId, amount }]
  for (const o of operations) {
    if (!o.date) continue;
    if (o.date.slice(0, 7) !== monthStr) continue;
    const bId = String(o.bankId?._id ?? o.bankId);
    existingKeys.add(`${o.label}|${bId}|${o.amount}|${o.date.slice(0, 10)}`);
    existingFuzzy.push({ label: o.label, bankId: bId, amount: o.amount });
  }

  const sameLabel = (a, b) => {
    const al = (a || '').toLowerCase().trim();
    const bl = (b || '').toLowerCase().trim();
    if (!al || !bl) return false;
    return al.includes(bl) || bl.includes(al);
  };

  const previews = [];
  for (const r of recurring) {
    if (r.toBankId) continue;
    if (!r.bankId) continue;
    const day = Math.min(r.dayOfMonth ?? 1, lastDay);
    const date = `${monthStr}-${String(day).padStart(2, '0')}`;
    const rBank = String(r.bankId?._id ?? r.bankId);

    const exactKey = `${r.label}|${rBank}|${r.amount}|${date}`;
    if (existingKeys.has(exactKey)) continue;
    const fuzzyHit = existingFuzzy.some((o) => {
      if (o.bankId !== rBank) return false;
      if (!sameLabel(o.label, r.label)) return false;
      if (!r.amount || !o.amount) return false;
      if (Math.sign(r.amount) !== Math.sign(o.amount)) return false;
      return Math.abs(o.amount - r.amount) <= Math.abs(r.amount) * 0.10;
    });
    if (fuzzyHit) continue;

    previews.push({
      _id: `preview:${r._id ?? r.recurringId}:${date}`,
      recurringId: String(r._id ?? r.recurringId),
      label: r.label,
      amount: r.amount,
      date,
      bankId: r.bankId,
      bankLabel: banksMap.get(rBank) ?? '',
      categoryId: r.categoryId ?? null,
      isPreview: true,
    });
  }
  return previews;
}

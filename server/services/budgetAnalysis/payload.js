// Construit le payload anonymisé envoyé à Claude.
// Pas de label d'op, pas de bankId — seulement date/amount/categoryId.
function buildPayload({ year, month, categories, recurring, currentMonthOps, historyOps }) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const recByCat = new Map();
  for (const r of recurring) {
    const cid = String(r.categoryId?._id ?? r.categoryId ?? '');
    if (!cid) continue;
    recByCat.set(cid, (recByCat.get(cid) ?? 0) + Math.abs(Number(r.amount) || 0));
  }

  const payloadCats = categories.map((c) => {
    const id = String(c._id);
    const recSum = recByCat.get(id) ?? 0;
    const max = Number(c.maxAmount ?? 0);
    return {
      id,
      label: c.label,
      kind: c.kind ?? 'debit',
      monthlyBudget: Math.round((recSum + max) * 100) / 100,
      isAuto: !!c.isAuto,
    };
  });

  const operations = currentMonthOps.map((o) => ({
    date: String(o.date).slice(0, 10),
    amount: Number(o.amount),
    categoryId: o.categoryId ? String(o.categoryId?._id ?? o.categoryId) : null,
  }));

  // Bucket historique en 6 mois N-1..N-6.
  const buckets = new Map();
  for (let i = 1; i <= 6; i += 1) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    buckets.set(`${y}-${String(m).padStart(2, '0')}`, new Map());
  }
  for (const o of historyOps) {
    const key = String(o.date).slice(0, 7);
    const byCat = buckets.get(key);
    if (!byCat) continue;
    const cid = String(o.categoryId?._id ?? o.categoryId ?? '-');
    const slot = byCat.get(cid) ?? { totalDebit: 0, totalCredit: 0, opsCount: 0 };
    const amt = Number(o.amount);
    if (amt < 0) slot.totalDebit  += -amt;
    else         slot.totalCredit += amt;
    slot.opsCount += 1;
    byCat.set(cid, slot);
  }
  const history = [...buckets.entries()].map(([mk, byCat]) => ({
    month: mk,
    byCategory: [...byCat.entries()].map(([cid, agg]) => ({
      categoryId: cid,
      totalDebit:  Math.round(agg.totalDebit  * 100) / 100,
      totalCredit: Math.round(agg.totalCredit * 100) / 100,
      opsCount: agg.opsCount,
    })),
  }));

  return {
    month: monthStr,
    currency: 'EUR',
    categories: payloadCats,
    currentMonth: { operations },
    history,
  };
}

module.exports = { buildPayload };

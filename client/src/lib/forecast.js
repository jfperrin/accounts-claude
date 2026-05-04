import dayjs from 'dayjs';

// Décomposition du flux mensuel estimé par banque :
//   monthlyNet = recurringNet + ponctualAvg
// où :
//   recurringNet = Σ amount des récurrentes (signé) → connu, déterministe
//   ponctualAvg  = (Σ ops sur N derniers mois pleins / N) − recurringNet
//                  → résidu non-récurrent, moyenné
// Identité : ponctualAvg + recurringNet = totalAvg historique (l'historique
// inclut déjà les récurrentes générées, donc on les retranche pour isoler
// les ponctuelles).
export function computeMonthlyNetByBank({ banks, recurring, history, historyMonths = 6 }) {
  const recurringByBank = new Map();
  for (const r of recurring) {
    const id = String(r.bankId?._id ?? r.bankId);
    recurringByBank.set(id, (recurringByBank.get(id) ?? 0) + r.amount);
  }

  const cutoffStart = dayjs().subtract(historyMonths, 'month').startOf('month');
  const cutoffEnd = dayjs().startOf('month');
  const histByBank = new Map();
  for (const o of history) {
    const d = dayjs(o.date);
    if (d.isBefore(cutoffStart) || !d.isBefore(cutoffEnd)) continue;
    const id = String(o.bankId?._id ?? o.bankId);
    histByBank.set(id, (histByBank.get(id) ?? 0) + o.amount);
  }

  return banks.map((b) => {
    const id = String(b._id);
    const recurringNet = recurringByBank.get(id) ?? 0;
    const totalAvg = (histByBank.get(id) ?? 0) / historyMonths;
    return {
      bank: b,
      recurringNet,
      ponctualAvg: totalAvg - recurringNet,
      monthlyNet: totalAvg,
    };
  });
}

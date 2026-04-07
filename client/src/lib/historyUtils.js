const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Transforme les périodes et leurs opérations en points de données pour le graphique.
 * Les périodes sans solde initial (balances vide) sont exclues.
 * Le résultat est trié chronologiquement (année ASC, mois ASC).
 *
 * @param {Array}  periods              Liste des périodes (model Period)
 * @param {Object} operationsByPeriodId { [periodId]: Operation[] }
 * @returns {{ label: string, total: number }[]}
 */
export function computeChartData(periods, operationsByPeriodId) {
  return periods
    .slice()
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .reduce((acc, period) => {
      const balances = period.balances ?? {};
      const bankIds = Object.keys(balances);
      if (bankIds.length === 0) return acc;

      const ops = operationsByPeriodId[period._id] ?? [];
      const unpointedSums = {};
      for (const op of ops) {
        if (!op.pointed) {
          const bid = op.bankId?._id ?? op.bankId;
          unpointedSums[bid] = (unpointedSums[bid] ?? 0) + op.amount;
        }
      }

      const total = bankIds.reduce(
        (s, bid) => s + balances[bid] + (unpointedSums[bid] ?? 0),
        0
      );

      const year2 = String(period.year).slice(2);
      const label = `${MONTHS_SHORT[period.month - 1]} ${year2}`;
      return [...acc, { label, total }];
    }, []);
}

/**
 * Calcule les indicateurs résumé à partir des données du graphique.
 *
 * @param {{ label: string, total: number }[]} chartData
 * @returns {{
 *   current: number|null,
 *   evolution: number|null,
 *   best: { label: string, total: number }|null
 * }}
 */
export function computeSummary(chartData) {
  if (chartData.length === 0) return { current: null, evolution: null, best: null };

  const current = chartData[chartData.length - 1].total;

  const previous = chartData.length >= 2 ? chartData[chartData.length - 2].total : null;
  const evolution =
    previous !== null && previous !== 0
      ? ((current - previous) / Math.abs(previous)) * 100
      : null;

  const best = chartData.reduce((b, d) => (d.total > b.total ? d : b), chartData[0]);

  return { current, evolution, best };
}

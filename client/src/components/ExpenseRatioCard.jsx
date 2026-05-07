import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

export default function ExpenseRatioCard({ operations, categories, history = [] }) {
  const { ratio, hasIncome, avgRatio, monthsCounted } = useMemo(() => {
    const catById = new Map(categories.map((c) => [String(c._id), c]));
    const partition = (ops, start, end) => {
      let income = 0; let expense = 0;
      for (const o of ops) {
        if (!o.categoryId) continue;
        const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
        if (!cat || cat.kind === 'transfer') continue;
        if (start || end) {
          const d = dayjs(o.date);
          if (start && d.isBefore(start)) continue;
          if (end && d.isAfter(end)) continue;
        }
        if (cat.kind === 'credit') income += Math.max(0, o.amount);
        else expense += Math.max(0, -o.amount);
      }
      return { income, expense };
    };

    const cur = partition(operations);
    const curRatio = cur.income > 0 ? (cur.expense / cur.income) * 100 : null;

    // Moyenne sur les 6 mois pleins glissants. Le mois courant est exclu pour
    // que la projection reste un repère stable (sinon en début de mois la
    // moyenne serait tirée vers le bas par un mois en cours partiel).
    const ratios = [];
    const today = dayjs();
    for (let i = 1; i <= 6; i++) {
      const m = today.subtract(i, 'month');
      const ms = m.startOf('month');
      const me = m.endOf('month');
      const { income, expense } = partition(history, ms, me);
      if (income > 0) ratios.push((expense / income) * 100);
    }
    const avg = ratios.length > 0
      ? ratios.reduce((s, v) => s + v, 0) / ratios.length
      : null;

    return {
      ratio: curRatio,
      hasIncome: cur.income > 0,
      avgRatio: avg,
      monthsCounted: ratios.length,
    };
  }, [operations, categories, history]);

  const overrun = ratio != null && ratio > 100;
  const avgOverrun = avgRatio != null && avgRatio > 100;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Percent className="h-4 w-4 text-indigo-600" />
          Taux de dépense
          <InfoTip>
            Part des revenus consommée par les dépenses sur la période
            sélectionnée. Sous 100&nbsp;% vous épargnez ; au-dessus, le
            mois est déficitaire. Le calcul ne prend en compte que les
            opérations dont la catégorie est de type revenu ou dépense
            — transferts internes et opérations sans catégorie exclus.
            Le second chiffre est la moyenne des taux sur les
            {' '}<strong>6 mois pleins glissants</strong> (mois courant
            exclu) — un repère stable pour comparer le mois en cours à
            ses habitudes.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">dépenses / revenus</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        {hasIncome ? (
          <span className={cn(
            'text-6xl font-extrabold tabular-nums leading-none',
            overrun ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          )}>
            {Math.round(ratio)}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Aucun revenu sur la période</span>
        )}
        {avgRatio != null && (
          <div className="text-xs text-muted-foreground">
            Moyenne {monthsCounted} mois :{' '}
            <span className={cn(
              'font-semibold tabular-nums',
              avgOverrun ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
            )}>
              {Math.round(avgRatio)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

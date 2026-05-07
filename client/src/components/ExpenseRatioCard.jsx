import { useMemo } from 'react';
import { Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

export default function ExpenseRatioCard({ operations, categories }) {
  const { ratio, hasIncome } = useMemo(() => {
    const catById = new Map(categories.map((c) => [String(c._id), c]));
    let income = 0; let expense = 0;
    for (const o of operations) {
      if (!o.categoryId) continue;
      const cat = catById.get(String(o.categoryId));
      if (!cat || cat.kind === 'transfer') continue;
      if (cat.kind === 'credit') income += Math.max(0, o.amount);
      else expense += Math.max(0, -o.amount);
    }
    if (income <= 0) return { ratio: null, hasIncome: false };
    return { ratio: (expense / income) * 100, hasIncome: true };
  }, [operations, categories]);

  const overrun = ratio != null && ratio > 100;

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
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">dépenses / revenus</p>
      </div>
      <div className="flex items-center justify-center py-8">
        {hasIncome ? (
          <span className={cn(
            'text-6xl font-extrabold tabular-nums',
            overrun ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400',
          )}>
            {Math.round(ratio)}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Aucun revenu sur la période</span>
        )}
      </div>
    </div>
  );
}

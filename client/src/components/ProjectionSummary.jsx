import { useMemo } from 'react';
import dayjs from 'dayjs';
import { TrendingUp } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import { computeMonthlyNetByBank } from '@/lib/forecast';

const HORIZONS = [3, 6, 12];

export default function ProjectionSummary({ banks, recurring, history, categories = [] }) {
  const { totalCurrent, monthlyTotalNet, recurringTotal, ponctualTotal } = useMemo(() => {
    const stats = computeMonthlyNetByBank({ banks, recurring, history, categories });
    return {
      totalCurrent: banks.reduce((s, b) => s + (b.currentBalance ?? 0), 0),
      monthlyTotalNet: stats.reduce((s, x) => s + x.monthlyNet, 0),
      recurringTotal: stats.reduce((s, x) => s + x.recurringNet, 0),
      ponctualTotal: stats.reduce((s, x) => s + x.ponctualAvg, 0),
    };
  }, [banks, recurring, history, categories]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-indigo-600" />
          Projection
        </h2>
        <p className={cn(
          'text-xs tabular-nums font-semibold',
          monthlyTotalNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        )}>
          {monthlyTotalNet >= 0 ? '+' : ''}{formatEur(monthlyTotalNet)} / mois
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {HORIZONS.map((n) => {
          const projected = totalCurrent + monthlyTotalNet * n;
          const diff = projected - totalCurrent;
          return (
            <div key={n} className="rounded-md border border-border/60 bg-muted/30 p-2">
              <div className="text-xs text-muted-foreground">+{n} mois</div>
              <div className={cn(
                'mt-1 text-base font-bold tabular-nums',
                projected >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                {formatEur(projected)}
              </div>
              <div className={cn(
                'text-[11px] tabular-nums',
                diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                {diff >= 0 ? '+' : ''}{formatEur(diff)}
              </div>
              <div className="text-[10px] text-muted-foreground">{dayjs().add(n, 'month').format('MMM YYYY')}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground tabular-nums">
        <span>Récurrent : {recurringTotal >= 0 ? '+' : ''}{formatEur(recurringTotal)}</span>
        <span>Ponctuel (moy. 6 mois) : {ponctualTotal >= 0 ? '+' : ''}{formatEur(ponctualTotal)}</span>
      </div>
    </div>
  );
}

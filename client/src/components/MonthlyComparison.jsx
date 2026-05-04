import { useMemo } from 'react';
import dayjs from 'dayjs';
import { CalendarRange } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';

function aggregate(operations, start, end) {
  let revenues = 0;
  let expenses = 0;
  for (const o of operations) {
    const d = dayjs(o.date);
    if (d.isBefore(start) || d.isAfter(end)) continue;
    if (o.amount >= 0) revenues += o.amount;
    else expenses += -o.amount;
  }
  return { revenues, expenses, net: revenues - expenses };
}

export default function MonthlyComparison({ operations }) {
  const { current, previous, rangeLabel } = useMemo(() => {
    const today = dayjs().endOf('day');
    const dayOfMonth = today.date();
    const curStart = today.startOf('month');
    const prevMonth = today.subtract(1, 'month');
    // À date équivalente : on borne le mois précédent au même jour-du-mois
    // (ou au dernier jour si le mois précédent est plus court).
    const prevEndDay = Math.min(dayOfMonth, prevMonth.endOf('month').date());
    const prevEnd = prevMonth.startOf('month').date(prevEndDay).endOf('day');
    return {
      current: aggregate(operations, curStart, today),
      previous: aggregate(operations, prevMonth.startOf('month'), prevEnd),
      rangeLabel: `du 1 au ${dayOfMonth}`,
    };
  }, [operations]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-indigo-600" />
          Mois en cours vs précédent
        </h2>
        <p className="text-xs text-muted-foreground">{rangeLabel}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Cell label="Revenus" current={current.revenues} previous={previous.revenues} positiveIsGood />
        <Cell label="Dépenses" current={current.expenses} previous={previous.expenses} positiveIsGood={false} />
        <Cell label="Net" current={current.net} previous={previous.net} positiveIsGood signed />
      </div>
    </div>
  );
}

function Cell({ label, current, previous, positiveIsGood, signed }) {
  const diff = current - previous;
  const same = diff === 0;
  const better = positiveIsGood ? diff > 0 : diff < 0;
  const fmt = (v) => (signed && v > 0 ? `+${formatEur(v)}` : formatEur(v));
  const pct = previous > 0 ? (diff / previous) * 100 : null;
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums">{fmt(current)}</div>
      <div className={cn(
        'text-[11px] tabular-nums',
        same && 'text-muted-foreground',
        !same && better && 'text-emerald-600 dark:text-emerald-400',
        !same && !better && 'text-rose-600 dark:text-rose-400',
      )}>
        {same
          ? '='
          : `${diff >= 0 ? '+' : ''}${formatEur(diff)}${pct != null ? ` (${diff >= 0 ? '+' : ''}${pct.toFixed(0)}%)` : ''}`}
      </div>
      <div className="text-[10px] text-muted-foreground tabular-nums">vs {formatEur(previous)}</div>
    </div>
  );
}

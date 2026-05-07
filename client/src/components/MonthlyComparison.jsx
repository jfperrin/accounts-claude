import { useMemo } from 'react';
import dayjs from 'dayjs';
import { CalendarRange } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

function aggregate(operations, start, end, transferCatIds) {
  let revenues = 0;
  let expenses = 0;
  for (const o of operations) {
    if (o.categoryId && transferCatIds.has(String(o.categoryId?._id ?? o.categoryId))) continue;
    const d = dayjs(o.date);
    if (d.isBefore(start) || d.isAfter(end)) continue;
    if (o.amount >= 0) revenues += o.amount;
    else expenses += -o.amount;
  }
  return { revenues, expenses, net: revenues - expenses };
}

export default function MonthlyComparison({ operations, categories = [], monthOffset = 0 }) {
  const {
    current, previous, currentLabel, previousLabel, rangeLabel,
  } = useMemo(() => {
    const transferCatIds = new Set(
      categories.filter((c) => c.kind === 'transfer').map((c) => String(c._id)),
    );
    const sel = dayjs().add(monthOffset, 'month');
    const prev = sel.subtract(1, 'month');
    const today = dayjs().endOf('day');
    const isCurrentMonth = monthOffset === 0;

    const curStart = sel.startOf('month');
    // Mois courant : on borne à aujourd'hui pour comparer "à date équivalente".
    // Mois passé/futur : mois plein.
    const curEnd = isCurrentMonth ? today : sel.endOf('month');

    const prevStart = prev.startOf('month');
    let prevEnd;
    if (isCurrentMonth) {
      // Même jour-du-mois (ou dernier jour si mois précédent plus court).
      const dayOfMonth = today.date();
      const prevEndDay = Math.min(dayOfMonth, prev.endOf('month').date());
      prevEnd = prev.startOf('month').date(prevEndDay).endOf('day');
    } else {
      prevEnd = prev.endOf('month');
    }

    return {
      current: aggregate(operations, curStart, curEnd, transferCatIds),
      previous: aggregate(operations, prevStart, prevEnd, transferCatIds),
      currentLabel: sel.format('MMM YYYY'),
      previousLabel: prev.format('MMM YYYY'),
      rangeLabel: isCurrentMonth ? `du 1 au ${today.date()}` : 'mois plein',
    };
  }, [operations, categories, monthOffset]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-indigo-600" />
          <span className="capitalize">{currentLabel}</span>
          <span className="text-muted-foreground font-normal">vs</span>
          <span className="capitalize">{previousLabel}</span>
          <InfoTip>
            Comparaison du mois sélectionné avec le précédent. Sur le
            mois en cours, on s'arrête à aujourd'hui et on confronte au
            même quantième du mois d'avant — sinon mois pleins. Les
            transferts internes sont exclus. La couleur de la variation
            indique si elle est favorable (vert) ou non (rose).
          </InfoTip>
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

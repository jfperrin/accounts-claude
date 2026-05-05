import { useMemo } from 'react';
import dayjs from 'dayjs';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import { DEFAULT_COLOR } from '@/lib/categoryColors';

// Pour une catégorie, le budget MENSUEL = somme des récurrentes assignées
// (en valeur directionnelle selon kind) + maxAmount complémentaire.
// Identique au calcul de CategoriesPage — gardé inline pour ne pas coupler
// les deux pages via un util qui figerait la sémantique trop tôt.
function directional(sum, kind) {
  return kind === 'credit' ? Math.max(0, sum) : Math.max(0, -sum);
}

function monthsInRange(startDate, endDate) {
  const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
  return Math.max(days / 30.4375, 0);
}

export default function BudgetSummary({
  categories, recurring, operations, startDate, endDate,
}) {
  const months = useMemo(() => monthsInRange(startDate, endDate), [startDate, endDate]);

  const recurringByCategory = useMemo(() => {
    const m = new Map();
    for (const r of recurring) {
      if (!r.categoryId) continue;
      m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + r.amount);
    }
    return m;
  }, [recurring]);

  const actualByCategory = useMemo(() => {
    const m = new Map();
    for (const o of operations) {
      if (!o.categoryId) continue;
      m.set(o.categoryId, (m.get(o.categoryId) ?? 0) + o.amount);
    }
    return m;
  }, [operations]);

  const rows = useMemo(() => categories
    .filter((c) => c.kind !== 'transfer')
    .map((c) => {
      const recurringSum = directional(recurringByCategory.get(c._id) ?? 0, c.kind);
      const monthlyBudget = recurringSum + (c.maxAmount ?? 0);
      const periodBudget = monthlyBudget * months;
      const actual = directional(actualByCategory.get(c._id) ?? 0, c.kind);
      return { cat: c, periodBudget, actual };
    })
    .filter((r) => r.periodBudget > 0 || r.actual > 0)
    .sort((a, b) => {
      // Revenus en premier, puis dépenses, chacun trié par budget décroissant
      if (a.cat.kind !== b.cat.kind) return a.cat.kind === 'credit' ? -1 : 1;
      return b.periodBudget - a.periodBudget;
    }),
  [categories, recurringByCategory, actualByCategory, months]);

  const totals = useMemo(() => {
    let budgetCredit = 0; let budgetDebit = 0;
    let actualCredit = 0; let actualDebit = 0;
    for (const r of rows) {
      if (r.cat.kind === 'credit') {
        budgetCredit += r.periodBudget;
        actualCredit += r.actual;
      } else {
        budgetDebit += r.periodBudget;
        actualDebit += r.actual;
      }
    }
    return {
      budgetCredit, budgetDebit, actualCredit, actualDebit,
      budgetNet: budgetCredit - budgetDebit,
      actualNet: actualCredit - actualDebit,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="mb-1 text-sm font-semibold">Budget</h2>
        <p className="text-sm text-muted-foreground">
          Aucune catégorie avec budget ou opération sur la période. Définissez un budget mensuel depuis la page Catégories.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Budget</h2>
        <p className="text-xs text-muted-foreground">
          {months < 1.05
            ? '~1 mois'
            : `~${months.toFixed(1).replace('.', ',')} mois`}
          {' · prévu vs réel'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <SummaryCell
          icon={TrendingUp}
          label="Revenus"
          actual={totals.actualCredit}
          budget={totals.budgetCredit}
          tone="credit"
        />
        <SummaryCell
          icon={TrendingDown}
          label="Dépenses"
          actual={totals.actualDebit}
          budget={totals.budgetDebit}
          tone="debit"
        />
        <SummaryCell
          icon={Wallet}
          label="Solde"
          actual={totals.actualNet}
          budget={totals.budgetNet}
          tone={totals.actualNet >= 0 ? 'credit' : 'debit'}
          showSign
        />
      </div>

      <ul className="space-y-2">
        {rows.map(({ cat, periodBudget, actual }) => (
          <BudgetRow key={cat._id} cat={cat} periodBudget={periodBudget} actual={actual} />
        ))}
      </ul>
    </div>
  );
}

function SummaryCell({ icon: Icon, label, actual, budget, tone, showSign }) {
  const fmt = (v) => (showSign && v > 0 ? `+${formatEur(v)}` : formatEur(v));
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn(
        'mt-1 text-base font-bold tabular-nums',
        tone === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}>
        {fmt(actual)}
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        / {fmt(budget)}
      </div>
    </div>
  );
}

function BudgetRow({ cat, periodBudget, actual }) {
  const isCredit = cat.kind === 'credit';
  const color = cat.color || DEFAULT_COLOR;
  // Pour un revenu : ratio = atteint / prévu (idéalement ≥ 1)
  // Pour une dépense : ratio = consommé / autorisé (alerte si > 1)
  const ratio = periodBudget > 0 ? actual / periodBudget : 0;
  const overrun = !isCredit && ratio > 1;
  const pct = Math.min(ratio * 100, 100);

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-2 text-sm">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 truncate font-medium">{cat.label}</span>
        <span className={cn(
          'tabular-nums font-semibold',
          overrun && 'text-rose-600 dark:text-rose-400',
        )}>
          {formatEur(actual)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          / {formatEur(periodBudget)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            overrun && 'bg-rose-500',
          )}
          style={{
            width: `${pct}%`,
            backgroundColor: overrun ? undefined : color,
          }}
        />
      </div>
    </li>
  );
}

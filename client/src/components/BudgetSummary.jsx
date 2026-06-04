import { useMemo } from 'react';
import {
  AlertTriangle, HelpCircle, PiggyBank, TrendingDown, TrendingUp, Wallet,
} from 'lucide-react';
import {
  cn, formatEur, formatSignedEur, amountClass,
} from '@/lib/utils';
import { computeBudgetRows } from '@/lib/budget';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import InfoTip from '@/components/InfoTip';
import EmptyState from '@/components/EmptyState';

export default function BudgetSummary({ categories, recurring, operations }) {
  const {
    rows, totals, uncategorized, overruns,
  } = useMemo(
    () => computeBudgetRows({ categories, recurring, operations }),
    [categories, recurring, operations],
  );

  if (rows.length === 0) {
    return (
      <div id="budget" className="scroll-mt-20 rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="mb-1 text-sm font-semibold">Budget</h2>
        <EmptyState
          variant="card"
          icon={PiggyBank}
          title="Aucun budget défini"
          description="Définis un budget mensuel par catégorie (récurrentes assignées + complément) pour visualiser le réel vs le prévu."
          actions={
            <a href="/categories" className="text-xs font-medium text-primary hover:underline">
              Aller aux catégories →
            </a>
          }
        />
      </div>
    );
  }

  return (
    <div id="budget" className="scroll-mt-20 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          Budget
          <InfoTip>
            Pour chaque catégorie, le premier chiffre est le <strong>réel</strong>
            {' '}constaté sur la période, le second le <strong>prévu</strong> (somme des
            récurrentes assignées + complément mensuel <em>maxAmount</em>, arrondi à la
            dizaine supérieure). La jauge se remplit jusqu'au réel ; le repère marque le
            budget et la part au-delà passe en rouge. Transferts internes et opérations
            sans catégorie sont exclus des totaux ; les non catégorisées sont totalisées
            séparément en bas.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">réel vs prévu</p>
      </div>

      {overruns.count > 0 && (
        <div className="mb-4 rounded-lg border border-debit/30 bg-debit/10 p-2.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-debit">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {overruns.count} dépassement{overruns.count > 1 ? 's' : ''}
            <span className="ml-auto tabular-nums">
              {formatSignedEur(overruns.totalOver)}
              <span className="ml-1 text-xs font-normal opacity-80">au total</span>
            </span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {overruns.items.map(({ cat, over }) => (
              <li
                key={cat._id}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-0.5 text-xs"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color || DEFAULT_COLOR }}
                />
                <span className="max-w-32 truncate font-medium">{cat.label}</span>
                <span className="tabular-nums font-semibold text-debit">{formatSignedEur(over)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        {rows.map((row) => (
          <BudgetRow key={row.cat._id} {...row} />
        ))}
      </ul>

      {uncategorized.count > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-sm">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate font-medium">Sans catégorie</span>
          <span className={cn('tabular-nums font-semibold', amountClass(uncategorized.total))}>
            {formatEur(uncategorized.total)}
          </span>
        </div>
      )}
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
        tone === 'credit' ? 'text-credit' : 'text-debit',
      )}>
        {fmt(actual)}
      </div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        / {fmt(budget)}
      </div>
    </div>
  );
}

function BudgetRow({
  cat, budget, actual, ratio, over, overBudget, depth = 0,
}) {
  const color = cat.color || DEFAULT_COLOR;

  // Jauge cible : la piste représente le plus grand de (budget, réel) ; la barre
  // se remplit jusqu'au réel et la part au-delà du budget passe en rouge.
  const track = Math.max(budget, actual, 1);
  const budgetPct = Math.min((budget / track) * 100, 100);
  const actualPct = Math.max(Math.min((actual / track) * 100, 100), 0);
  const colorWidth = overBudget ? budgetPct : actualPct;
  const overWidth = overBudget ? Math.max(actualPct - budgetPct, 0) : 0;

  return (
    <li className={cn('space-y-1', depth > 0 && 'pl-4')}>
      <div className="flex items-center gap-2 text-sm">
        {depth > 0 && <span className="shrink-0 text-xs text-muted-foreground">↳</span>}
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 truncate font-medium">{cat.label}</span>
        {overBudget && (
          <span className="shrink-0 tabular-nums text-xs font-semibold text-debit">
            {formatSignedEur(over)} · {Math.round(ratio * 100)}%
          </span>
        )}
        <span className={cn('tabular-nums font-semibold', overBudget && 'text-debit')}>
          {formatEur(actual)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          / {formatEur(budget)}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out"
          style={{ width: `${colorWidth}%`, backgroundColor: color }}
        />
        {overBudget && (
          <div
            className="absolute inset-y-0 bg-debit transition-[width] duration-500 ease-out"
            style={{ left: `${budgetPct}%`, width: `${overWidth}%` }}
          />
        )}
        {budget > 0 && (
          <span
            className="absolute inset-y-0 w-0.5 bg-foreground/40"
            style={{ left: `calc(${budgetPct}% - 1px)` }}
          />
        )}
      </div>
    </li>
  );
}

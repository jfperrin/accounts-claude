import { useMemo } from 'react';
import { HelpCircle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import { DEFAULT_COLOR } from '@/lib/categoryColors';

// Budget mensuel d'une catégorie = somme des récurrentes assignées (en valeur
// directionnelle selon kind) + maxAmount complémentaire. Identique au calcul
// de CategoriesPage — gardé inline pour ne pas coupler les deux pages via un
// util qui figerait la sémantique trop tôt.
function directional(sum, kind) {
  return kind === 'credit' ? Math.max(0, sum) : Math.max(0, -sum);
}

export default function BudgetSummary({
  categories, recurring, operations,
}) {
  const uncategorized = useMemo(() => {
    let count = 0; let total = 0;
    for (const o of operations) {
      if (!o.categoryId) { count += 1; total += o.amount; }
    }
    return { count, total };
  }, [operations]);
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

  const rows = useMemo(() => {
    // 1. Calcule budget/actual pour chaque catégorie non-transfer.
    const computed = categories
      .filter((c) => c.kind !== 'transfer')
      .map((c) => {
        const recurringSum = directional(recurringByCategory.get(c._id) ?? 0, c.kind);
        const rawBudget = recurringSum + (c.maxAmount ?? 0);
        const budget = Math.ceil(rawBudget / 10) * 10;
        const actual = directional(actualByCategory.get(c._id) ?? 0, c.kind);
        return { cat: c, budget, actual, hasOwn: budget > 0 || actual > 0 };
      });
    const byId = new Map(computed.map((r) => [String(r.cat._id), r]));

    // 2. Sépare racines / enfants. Un parentId qui ne pointe sur aucune
    //    catégorie connue → la catégorie est traitée en racine.
    const childrenByParent = new Map();
    const roots = [];
    for (const r of computed) {
      const pid = r.cat.parentId ? String(r.cat.parentId) : null;
      if (pid && byId.has(pid)) {
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(r);
      } else {
        roots.push(r);
      }
    }

    // 3. Ordre : credit avant debit, puis par (budget+actual) décroissant.
    const score = (r) => r.budget + r.actual;
    const cmp = (a, b) => {
      if (a.cat.kind !== b.cat.kind) return a.cat.kind === 'credit' ? -1 : 1;
      return score(b) - score(a);
    };
    roots.sort(cmp);
    for (const arr of childrenByParent.values()) arr.sort(cmp);

    // 4. Aplatissement avec depth. Une racine s'affiche si elle a un budget/actuel
    //    propre, OU si au moins un de ses enfants est visible (pour conserver le
    //    groupement parent → sous-catégories).
    const out = [];
    for (const r of roots) {
      const kids = (childrenByParent.get(String(r.cat._id)) ?? []).filter((k) => k.hasOwn);
      if (!r.hasOwn && kids.length === 0) continue;
      out.push({ ...r, depth: 0 });
      for (const k of kids) out.push({ ...k, depth: 1 });
    }
    return out;
  }, [categories, recurringByCategory, actualByCategory]);

  const totals = useMemo(() => {
    let budgetCredit = 0; let budgetDebit = 0;
    for (const r of rows) {
      if (r.cat.kind === 'credit') budgetCredit += r.budget;
      else budgetDebit += r.budget;
    }
    // Réel = somme brute sur toutes les opérations de la période (catégorisées
    // ou non), pour que Revenus/Dépenses/Solde reflètent l'argent réellement
    // entré/sorti — pas seulement la part rangée dans une catégorie.
    let actualCredit = 0; let actualDebit = 0;
    for (const o of operations) {
      if (o.amount >= 0) actualCredit += o.amount;
      else actualDebit += -o.amount;
    }
    return {
      budgetCredit, budgetDebit, actualCredit, actualDebit,
      budgetNet: budgetCredit - budgetDebit,
      actualNet: actualCredit - actualDebit,
    };
  }, [rows, operations]);

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
        <p className="text-xs text-muted-foreground">réel vs prévu</p>
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
        {rows.map(({ cat, budget, actual, depth }) => (
          <BudgetRow key={cat._id} cat={cat} budget={budget} actual={actual} depth={depth} />
        ))}
      </ul>

      {uncategorized.count > 0 && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-sm">
          <HelpCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate font-medium">Sans catégorie</span>
          <span className={cn(
            'tabular-nums font-semibold',
            uncategorized.total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
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

function BudgetRow({ cat, budget, actual, depth = 0 }) {
  const isCredit = cat.kind === 'credit';
  const color = cat.color || DEFAULT_COLOR;
  // Revenu : ratio = atteint / prévu (idéalement ≥ 1)
  // Dépense : ratio = consommé / autorisé (alerte si > 1)
  const ratio = budget > 0 ? actual / budget : 0;
  const overrun = !isCredit && ratio > 1;
  const pct = Math.min(ratio * 100, 100);

  return (
    <li className={cn('space-y-1', depth > 0 && 'pl-4')}>
      <div className="flex items-center gap-2 text-sm">
        {depth > 0 && <span className="text-muted-foreground text-xs shrink-0">↳</span>}
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="flex-1 truncate font-medium">{cat.label}</span>
        <span className={cn(
          'tabular-nums font-semibold',
          overrun && 'text-rose-600 dark:text-rose-400',
        )}>
          {formatEur(actual)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          / {formatEur(budget)}
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

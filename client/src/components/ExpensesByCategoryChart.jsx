import { useMemo } from 'react';
import { PieChart as PieChartIcon } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import { formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Compare deux YYYY-MM-DD via les 10 premiers caractères ISO. Indépendant du
// fuseau, contrairement à new Date(...) qui ramène à minuit UTC.
function isoDay(d) {
  return typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
}

export default function ExpensesByCategoryChart({ categories, operations, startDate, endDate }) {
  const { slices, total, uncategorized } = useMemo(() => {
    const sumById = new Map();
    let uncat = 0;
    for (const o of operations) {
      if (o.amount >= 0) continue;
      if (startDate || endDate) {
        const day = isoDay(o.date);
        if (startDate && day < startDate) continue;
        if (endDate && day > endDate) continue;
      }
      if (!o.categoryId) {
        uncat += Math.abs(o.amount);
        continue;
      }
      sumById.set(o.categoryId, (sumById.get(o.categoryId) ?? 0) + Math.abs(o.amount));
    }
    const catById = new Map(categories.map((c) => [c._id, c]));
    const list = [];
    for (const [id, value] of sumById.entries()) {
      const cat = catById.get(id);
      // On ne garde que les catégories de type "debit" — un débit posé sur
      // une catégorie credit (remboursement) ou transfer (virement interne)
      // n'est pas une dépense.
      if (!cat || cat.kind !== 'debit') continue;
      list.push({ id, label: cat.label, color: cat.color || DEFAULT_COLOR, value });
    }
    list.sort((a, b) => b.value - a.value);
    const tot = list.reduce((s, r) => s + r.value, 0);
    return { slices: list, total: tot, uncategorized: uncat };
  }, [categories, operations, startDate, endDate]);

  if (slices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <h2 className="mb-1 text-sm font-semibold flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-indigo-600" />
          Dépenses par catégorie
        </h2>
        <p className="text-sm text-muted-foreground">Aucune dépense sur cette période.</p>
        {uncategorized > 0 && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            Sans catégorie : {formatEur(uncategorized)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <PieChartIcon className="h-4 w-4 text-indigo-600" />
          Dépenses par catégorie
          <InfoTip>
            Répartition des dépenses sur la période sélectionnée. Seules
            les catégories de type <em>dépense</em> sont représentées —
            un débit posé sur une catégorie de revenu (remboursement) ou
            de transfert n'apparaît pas. Les opérations sans catégorie
            sont totalisées séparément en haut à droite.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          Total {formatEur(total)}
          {uncategorized > 0 && (
            <span className="ml-2">· Sans catégorie {formatEur(uncategorized)}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr] md:items-center">
        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="90%"
                paddingAngle={1}
                stroke="none"
              >
                {slices.map((s) => (
                  <Cell key={s.id} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-1.5">
          {slices.map((s) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="tabular-nums font-semibold">{formatEur(s.value)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                  {pct.toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const { label, value, color } = payload[0].payload;
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <div className="flex items-center gap-2 text-xs">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-medium">{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">
        {formatEur(value)} <span className="text-xs font-normal text-muted-foreground">({pct.toFixed(1)}%)</span>
      </div>
    </div>
  );
}

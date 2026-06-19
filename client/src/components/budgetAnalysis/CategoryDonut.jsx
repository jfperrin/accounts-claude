import { PieChart, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import { formatEur } from '@/lib/utils';

// `fill` posé directement sur chaque donnée plutôt que via <Cell>. Pourquoi :
// importer Cell de recharts tire `es-toolkit/compat/get` qui casse le wrap CJS
// de Vite (`require_isUnsafeProperty is not a function`). Pattern aligné avec
// ExpensesByCategoryChart.
export default function CategoryDonut({ data, categories }) {
  if (!data?.length) return null;
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const rows = data
    .map((d, i) => {
      const c = byId.get(String(d.categoryId));
      return {
        key: d.categoryId != null ? String(d.categoryId) : `row-${i}`,
        name: c?.label || 'Catégorie',
        fill: c?.color || DEFAULT_COLOR,
        amount: d.amount,
        share: d.share,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Répartition des dépenses</h2>
      <div className="flex flex-col gap-4">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={rows}
                dataKey="amount"
                nameKey="name"
                innerRadius="55%"
                outerRadius="90%"
                paddingAngle={2}
                stroke="none"
              />
              <Tooltip formatter={(v, _n, p) => [
                `${formatEur(v)} (${(p.payload.share * 100).toFixed(0)}%)`,
                p.payload.name,
              ]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.fill }} />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="tabular-nums font-semibold">{formatEur(r.amount)}</span>
              <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                {(r.share * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

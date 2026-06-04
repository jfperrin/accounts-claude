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
    .map((d) => {
      const c = byId.get(String(d.categoryId));
      return {
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
    </section>
  );
}

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import { formatEur } from '@/lib/utils';

export default function CategoryDonut({ data, categories }) {
  if (!data?.length) return null;
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const rows = data
    .map((d) => {
      const c = byId.get(String(d.categoryId));
      return {
        name: c?.label || 'Catégorie',
        color: c?.color || DEFAULT_COLOR,
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
            <Pie data={rows} dataKey="amount" nameKey="name"
              innerRadius={50} outerRadius={90} paddingAngle={2}>
              {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
            </Pie>
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

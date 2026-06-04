import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

const ICONS = { up: TrendingUp, down: TrendingDown, stable: Minus };
const COLORS = { up: 'text-debit', down: 'text-credit', stable: 'text-muted-foreground' };

export default function TrendsList({ trends, categories }) {
  if (!trends?.length) return null;
  const catLabel = (id) => categories.find((c) => String(c._id) === String(id))?.label || 'Inconnue';
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Tendances</h2>
      <ul className="space-y-1.5">
        {trends.map((t, i) => {
          const Icon = ICONS[t.direction] || Minus;
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLORS[t.direction]}`} />
              <div>
                <span className="font-medium">{catLabel(t.categoryId)}</span>{' '}
                <span className={COLORS[t.direction]}>
                  {t.direction === 'stable' ? 'stable' : `${t.direction === 'up' ? '+' : '−'}${Math.abs(t.magnitudePct).toFixed(0)}%`}
                </span>
                <span className="text-muted-foreground"> — {t.comment}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

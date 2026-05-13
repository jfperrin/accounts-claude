import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { cn, formatEur } from '@/lib/utils';

export default function BudgetChart({ data, chartCategories, totals }) {
  if (!chartCategories.length) return null;

  const balancePositive = totals.balance >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Budget mensuel</h2>
        <p className="text-xs text-muted-foreground">Dépenses / Revenus</p>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          barCategoryGap="35%"
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(v) => formatEur(v)}
            stroke="var(--muted-foreground)"
            fontSize={11}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={80}
          />
          <Tooltip content={<BudgetTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
          {chartCategories.map((c, i) => (
            <Bar
              key={c.label}
              dataKey={c.label}
              stackId="a"
              fill={c.color}
              radius={
                i === 0
                  ? [4, 0, 0, 4]
                  : i === chartCategories.length - 1 ? [0, 4, 4, 0] : 0
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-sm">
        <SummaryCell label="Dépenses" value={totals.debit} tone="debit" />
        <SummaryCell label="Revenus" value={totals.credit} tone="credit" />
        <SummaryCell
          label="Solde"
          value={totals.balance}
          tone={balancePositive ? 'credit' : 'debit'}
          showSign
        />
      </div>
    </div>
  );
}

function SummaryCell({ label, value, tone, showSign }) {
  const text = showSign && value > 0 ? `+${formatEur(value)}` : formatEur(value);
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'tabular-nums font-semibold',
        tone === 'credit' ? 'text-credit' : 'text-debit',
      )}>
        {text}
      </span>
    </div>
  );
}

function BudgetTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0);
  if (!items.length) return null;
  const total = items.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-semibold">{label}</p>
      {items.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.dataKey}</span>
          <span className="tabular-nums">{formatEur(p.value)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border/60 pt-1 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatEur(total)}</span>
      </div>
    </div>
  );
}

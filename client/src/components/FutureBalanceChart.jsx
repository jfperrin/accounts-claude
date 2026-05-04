import { useMemo } from 'react';
import dayjs from 'dayjs';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { computeMonthlyNetByBank } from '@/lib/forecast';
import { formatEur } from '@/lib/utils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function formatAxisValue(v) {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return Math.round(v).toString();
}

export default function FutureBalanceChart({ banks, recurring, history }) {
  const { data, series, showTotal } = useMemo(() => {
    const stats = computeMonthlyNetByBank({ banks, recurring, history });
    const points = [];
    for (let n = 0; n <= 12; n++) {
      const point = {
        month: n,
        label: n === 0 ? 'Auj.' : dayjs().add(n, 'month').format('MMM YY'),
      };
      let total = 0;
      for (const s of stats) {
        const val = (s.bank.currentBalance ?? 0) + s.monthlyNet * n;
        point[`bank_${s.bank._id}`] = Math.round(val * 100) / 100;
        total += val;
      }
      point.total = Math.round(total * 100) / 100;
      points.push(point);
    }
    const ser = stats.map((s, idx) => ({
      key: `bank_${s.bank._id}`,
      label: s.bank.label,
      color: COLORS[idx % COLORS.length],
    }));
    return { data: points, series: ser, showTotal: banks.length > 1 };
  }, [banks, recurring, history]);

  if (banks.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-indigo-600" />
          Soldes prévisionnels (12 mois)
        </h2>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAxisValue} width={50} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
            {showTotal && (
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke="#0ea5e9"
                strokeWidth={3}
                strokeDasharray="6 3"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 shadow-md">
      <div className="text-xs font-medium mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular-nums font-semibold">{formatEur(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import { formatEur } from '@/lib/utils';
import { computeChartData, computeSummary } from '@/lib/historyUtils';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({ current: null, evolution: null, best: null });

  useEffect(() => {
    async function load() {
      try {
        const periods = await periodsApi.list();
        const opsByPeriod = Object.fromEntries(
          await Promise.all(
            periods.map(async (p) => [p._id, await operationsApi.list(p._id)])
          )
        );
        const data = computeChartData(periods, opsByPeriod);
        setChartData(data);
        setSummary(computeSummary(data));
      } catch {
        setError('Impossible de charger l\'historique.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-rose-600">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <TrendingUp className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cartes résumé ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Solde actuel */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Solde actuel
          </p>
          <p className={`text-2xl font-extrabold ${summary.current >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatEur(summary.current)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Période la plus récente</p>
        </div>

        {/* Évolution — masquée si < 2 périodes */}
        {summary.evolution !== null && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Évolution
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                summary.evolution >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {summary.evolution >= 0 ? '▲' : '▼'} {Math.abs(summary.evolution).toFixed(1)} %
            </span>
            <p className="mt-2 text-xs text-muted-foreground">vs période précédente</p>
          </div>
        )}

        {/* Meilleur mois */}
        {summary.best !== null && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Meilleur mois
            </p>
            <p className="mt-1 text-lg font-bold text-indigo-600">{summary.best.label}</p>
            <p className="text-xs text-muted-foreground">{formatEur(summary.best.total)}</p>
          </div>
        )}
      </div>

      {/* ── Graphique ── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-4">
          <p className="font-semibold text-foreground">Évolution du solde prévisionnel</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toutes banques · solde initial + opérations non-pointées
          </p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 12,
              }}
              formatter={(value) => [formatEur(value), 'Solde']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#colorTotal)"
              dot={false}
              activeDot={{ r: 5, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

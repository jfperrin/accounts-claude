import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Cumul des opérations jour par jour, en partant de 0 le 1er du mois.
// Trois courbes : mois sélectionné (M), précédent (M-1) et avant-précédent
// (M-2). Les transferts internes sont exclus pour rester homogène avec les
// autres analyses. Sur le mois en cours, la courbe M s'arrête à aujourd'hui.
export default function MonthlyTrendChart({
  operations = [], comparisonOps = [], history = [], categories = [], monthOffset = 0,
}) {
  const { data, currentLabel, previousLabel, prev2Label } = useMemo(() => {
    const catById = new Map(categories.map((c) => [String(c._id), c]));
    const isTransfer = (o) => {
      if (!o.categoryId) return false;
      const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
      return cat && cat.kind === 'transfer';
    };

    const sel = dayjs().add(monthOffset, 'month');
    const prev = sel.subtract(1, 'month');
    const prev2 = sel.subtract(2, 'month');
    const selStart = sel.startOf('month');
    const selEnd = sel.endOf('month');
    const prevStart = prev.startOf('month');
    const prevEnd = prev.endOf('month');
    const prev2Start = prev2.startOf('month');
    const prev2End = prev2.endOf('month');
    const selDays = selEnd.date();
    const prevDays = prevEnd.date();
    const prev2Days = prev2End.date();
    const maxDays = Math.max(selDays, prevDays, prev2Days);

    const fillDays = (ops, start, end) => {
      const days = end.date();
      const byDay = new Array(days + 1).fill(0);
      for (const o of ops) {
        if (isTransfer(o)) continue;
        const d = dayjs(o.date);
        if (d.isBefore(start) || d.isAfter(end)) continue;
        byDay[d.date()] += o.amount;
      }
      return { byDay, days };
    };

    const { byDay: selByDay } = fillDays(operations, selStart, selEnd);
    const { byDay: prevByDay } = fillDays(comparisonOps, prevStart, prevEnd);
    // M-2 vient de l'historique 6 mois (passé via prop) car comparisonOps ne
    // couvre que [M-1, M]. Si M-2 n'est pas dans la fenêtre, la courbe est
    // simplement absente.
    const { byDay: prev2ByDay } = fillDays(history, prev2Start, prev2End);

    // Pas de cap "aujourd'hui" sur le mois en cours : on inclut aussi les
    // opérations futures déjà en base (récurrentes générées, ops planifiées
    // à l'avance, etc.) pour donner une vraie projection de fin de mois.
    const out = [];
    let selSum = 0; let prevSum = 0; let prev2Sum = 0;
    for (let d = 1; d <= maxDays; d++) {
      if (d <= prevDays) prevSum += prevByDay[d];
      if (d <= prev2Days) prev2Sum += prev2ByDay[d];
      if (d <= selDays) selSum += selByDay[d];
      out.push({
        day: d,
        current: d <= selDays ? selSum : null,
        previous: d <= prevDays ? prevSum : null,
        prev2: d <= prev2Days ? prev2Sum : null,
      });
    }
    return {
      data: out,
      currentLabel: sel.format('MMM YYYY'),
      previousLabel: prev.format('MMM YYYY'),
      prev2Label: prev2.format('MMM YYYY'),
    };
  }, [operations, comparisonOps, history, categories, monthOffset]);

  // Ticks Y tous les 500 € de part et d'autre de 0, calés sur la plage
  // effective des courbes (avec un cran de marge sous/au-dessus).
  const yTicks = useMemo(() => {
    const STEP = 500;
    let min = 0; let max = 0;
    for (const row of data) {
      for (const k of ['current', 'previous', 'prev2']) {
        const v = row[k];
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const start = Math.floor(min / STEP) * STEP;
    const end = Math.ceil(max / STEP) * STEP;
    const out = [];
    for (let v = start; v <= end; v += STEP) out.push(v);
    return out;
  }, [data]);

  // Ticks X = un par jour, pour que la CartesianGrid trace une barre
  // verticale chaque jour même si les libellés sont masqués.
  const xTicks = useMemo(() => data.map((row) => row.day), [data]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <LineChartIcon className="h-4 w-4 text-indigo-600" />
          Évolution du solde mensuel
          <InfoTip>
            Cumul jour par jour des opérations en partant de 0 le 1er du
            mois. Trait plein pour le mois sélectionné (M), pointillé
            pour M-1, pointillé clair pour M-2. Sur le mois en cours, la
            courbe M va jusqu'à la fin du mois en intégrant les
            opérations futures déjà en base (récurrentes générées, ops
            planifiées). Si M-2 sort de la fenêtre d'historique chargée
            (6 mois glissants), sa courbe est absente. Les transferts
            internes sont exclus.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="capitalize">{prev2Label}</span>
          {' / '}
          <span className="capitalize">{previousLabel}</span>
          {' / '}
          <span className="capitalize">{currentLabel}</span>
        </p>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
            <XAxis
              dataKey="day"
              ticks={xTicks}
              interval={0}
              tick={{ fill: 'transparent' }}
              tickLine={false}
              axisLine={false}
              height={1}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-muted-foreground"
              tickFormatter={(v) => `${Math.round(v)}`}
              width={60}
              ticks={yTicks}
              domain={[yTicks[0] ?? 0, yTicks[yTicks.length - 1] ?? 0]}
              interval={0}
            />
            <ReferenceLine y={0} stroke="currentColor" className="text-muted-foreground" strokeWidth={1} />
            {monthOffset === 0 && (
              <ReferenceLine
                x={dayjs().date()}
                stroke="#6366f1"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: "Auj.", position: 'top', fill: '#6366f1', fontSize: 11 }}
              />
            )}
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="line"
              payload={[
                { value: prev2Label, type: 'line', color: '#f59e0b', id: 'prev2' },
                { value: previousLabel, type: 'line', color: '#10b981', id: 'previous' },
                { value: currentLabel, type: 'line', color: '#6366f1', id: 'current' },
              ]}
            />
            <Line
              type="monotone"
              dataKey="prev2"
              name={prev2Label}
              stroke="#f59e0b"
              strokeWidth={1.75}
              strokeDasharray="2 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name={previousLabel}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name={currentLabel}
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
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
      <div className="text-xs font-medium text-muted-foreground">Jour {label}</div>
      {payload.map((p) => (
        p.value == null ? null : (
          <div
            key={p.dataKey}
            className="text-sm font-semibold tabular-nums"
            style={{ color: p.color }}
          >
            <span className="capitalize">{p.name}</span> : {formatEur(p.value)}
          </div>
        )
      ))}
    </div>
  );
}

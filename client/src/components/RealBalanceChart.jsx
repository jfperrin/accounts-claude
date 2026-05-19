import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Wallet } from 'lucide-react';
import { formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Reconstruit le solde global (toutes banques confondues) jour par jour, en
// partant du currentBalance total comme ancre à la date du jour. Les ops
// passées reculent le solde depuis l'ancre, les ops futures déjà en base le
// projettent en avant. À aujourd'hui la courbe du mois sélectionné passe par
// le currentBalance ; à fin du mois en cours elle atteint le projectedBalance.
// Les transferts internes liés (transferId) sont déjà filtrés en amont — au
// niveau global ils sont neutres de toute façon.
export default function RealBalanceChart({
  banks = [], operations = [], history = [], monthOffset = 0,
}) {
  const ref = useMemo(
    () => banks.reduce((s, b) => s + (Number(b.currentBalance) || 0), 0),
    [banks],
  );

  // Union par _id : history couvre [M-6, today], operations couvre M (passé +
  // futur déjà en base). Indispensable pour avoir une seule source de vérité
  // pour le calcul du solde.
  const allOps = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const o of history) {
      const id = String(o._id);
      if (!seen.has(id)) { seen.add(id); out.push(o); }
    }
    for (const o of operations) {
      const id = String(o._id);
      if (!seen.has(id)) { seen.add(id); out.push(o); }
    }
    return out;
  }, [history, operations]);

  const { data, currentLabel, previousLabel, prev2Label } = useMemo(() => {
    const today = dayjs().startOf('day');
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

    const tMs = today.valueOf();
    const opsByDay = allOps.map((o) => ({
      ms: dayjs(o.date).startOf('day').valueOf(),
      amount: Number(o.amount) || 0,
    }));

    // Solde "à la fin du jour D". Convention : une op datée du jour J est
    // intégrée dans Solde(J) (cumul inclusif sur J). Solde(today) = ref.
    function balanceAt(dMs) {
      let sum = 0;
      if (dMs <= tMs) {
        for (const o of opsByDay) {
          if (o.ms > dMs && o.ms <= tMs) sum += o.amount;
        }
        return ref - sum;
      }
      for (const o of opsByDay) {
        if (o.ms > tMs && o.ms <= dMs) sum += o.amount;
      }
      return ref + sum;
    }

    const out = [];
    for (let d = 1; d <= maxDays; d++) {
      const dSelMs = d <= selDays ? selStart.add(d - 1, 'day').valueOf() : null;
      const dPrevMs = d <= prevDays ? prevStart.add(d - 1, 'day').valueOf() : null;
      const dPrev2Ms = d <= prev2Days ? prev2Start.add(d - 1, 'day').valueOf() : null;
      out.push({
        day: d,
        current: dSelMs != null ? balanceAt(dSelMs) : null,
        previous: dPrevMs != null ? balanceAt(dPrevMs) : null,
        prev2: dPrev2Ms != null ? balanceAt(dPrev2Ms) : null,
      });
    }
    return {
      data: out,
      currentLabel: sel.format('MMM YYYY'),
      previousLabel: prev.format('MMM YYYY'),
      prev2Label: prev2.format('MMM YYYY'),
    };
  }, [allOps, monthOffset, ref]);

  // Ticks Y adaptatifs : viser ~6 ticks. Sur le solde réel l'amplitude peut
  // aller de quelques dizaines d'euros (mois calme à 13k €) à plusieurs
  // milliers, un pas fixe rendrait l'axe illisible dans un cas comme dans
  // l'autre.
  const yTicks = useMemo(() => {
    if (!data.length) return [0];
    let min = Infinity; let max = -Infinity;
    for (const row of data) {
      for (const k of ['current', 'previous', 'prev2']) {
        const v = row[k];
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min === Infinity) return [0];
    if (ref < min) min = ref;
    if (ref > max) max = ref;
    // Forcer le 0 dans l'axe : repère visuel constant pour situer le solde.
    if (min > 0) min = 0;
    if (max < 0) max = 0;
    const range = Math.max(1, max - min);
    const rough = range / 6;
    const mag = 10 ** Math.floor(Math.log10(rough));
    const norm = rough / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const out = [];
    for (let v = start; v <= end; v += step) out.push(v);
    return out;
  }, [data, ref]);

  const xTicks = useMemo(() => data.map((row) => row.day), [data]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Évolution du solde réel
          <InfoTip>
            Reconstruction du solde global toutes banques confondues, jour par
            jour. À aujourd'hui la courbe du mois sélectionné passe exactement
            par le currentBalance saisi ; à fin du mois en cours elle atteint
            le projectedBalance. Les mois précédents sont reculés depuis
            aujourd'hui, donc les courbes vivent à leur niveau historique
            propre (pas alignées au 1er du mois). Les transferts internes
            liés sont exclus (neutres au global).
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
              tick={{ fontSize: 11, fill: 'currentColor' }}
              tickFormatter={(v) => (v === 1 || v % 5 === 0 ? String(v) : '')}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={{ stroke: 'currentColor' }}
              height={20}
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
            <ReferenceLine
              y={ref}
              stroke="currentColor"
              className="text-muted-foreground"
              strokeDasharray="2 4"
              strokeWidth={1}
            />
            {monthOffset === 0 && (
              <ReferenceLine
                x={dayjs().date()}
                stroke="var(--primary)"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{ value: "Auj.", position: 'top', fill: 'var(--primary)', fontSize: 11 }}
              />
            )}
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              iconType="line"
              payload={[
                { value: prev2Label, type: 'line', color: 'var(--muted-foreground)', id: 'prev2' },
                { value: previousLabel, type: 'line', color: 'var(--credit)', id: 'previous' },
                { value: currentLabel, type: 'line', color: 'var(--primary)', id: 'current' },
              ]}
            />
            <Line type="monotone" dataKey="prev2" name={prev2Label}
              stroke="var(--muted-foreground)" strokeWidth={1.75}
              strokeDasharray="2 4" dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="previous" name={previousLabel}
              stroke="var(--credit)" strokeWidth={2}
              strokeDasharray="4 3" dot={false} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="current" name={currentLabel}
              stroke="var(--primary)" strokeWidth={2.5}
              dot={false} connectNulls={false} isAnimationActive={false} />
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

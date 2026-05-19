import { useMemo } from 'react';
import dayjs from 'dayjs';
import { CalendarCheck, Wallet } from 'lucide-react';
import { computeHorizon, computeHorizonSparkline } from '@/lib/horizon';
import { cn, formatEur, amountClass } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const W = 140;
  const H = 40;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      // 2px de marge haute/basse pour éviter le clipping de la courbe.
      const y = H - ((p.value - min) / range) * (H - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-10 w-32 sm:w-36 text-muted-foreground/60 shrink-0"
      aria-hidden="true"
    >
      <polyline
        points={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export default function HeroHorizon({
  banks = [], unpointed = [], recurring = [], operations = [],
  monthOffset = 0, endDate,
}) {
  const data = useMemo(
    () => computeHorizon({ banks, unpointed, recurring, operations, monthOffset, endDate }),
    [banks, unpointed, recurring, operations, monthOffset, endDate],
  );

  const sparkline = useMemo(() => {
    if (data.pastMonth) return [];
    return computeHorizonSparkline({ banks, unpointed, recurring, operations, endDate });
  }, [data.pastMonth, banks, unpointed, recurring, operations, endDate]);

  if (data.pastMonth) {
    const eom = dayjs(endDate);
    const monthLabel = eom.isValid() ? eom.format('MMMM YYYY') : '';
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mois clos
            </p>
            <p className="text-sm text-foreground capitalize">
              {monthLabel} — période historique, pas de projection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const {
    horizon, actuel, unpointedSum, unpointedCount,
    recurringRemainingSum, recurringRemainingCount,
  } = data;

  const dateLabel = `au ${dayjs(endDate).format('D MMMM')}`;
  const horizonSigned = horizon > 0 ? `+${formatEur(horizon)}` : formatEur(horizon);
  const unpointedSigned = unpointedSum > 0 ? `+${formatEur(unpointedSum)}` : formatEur(unpointedSum);
  const recurringSigned = recurringRemainingSum > 0
    ? `+${formatEur(recurringRemainingSum)}`
    : formatEur(recurringRemainingSum);

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          Horizon
          <InfoTip>
            <strong>Horizon</strong> = solde actuel + opérations à pointer
            jusqu'à la fin du mois + récurrentes attendues d'ici-là.
            Réponse directe à « combien il me restera vraiment ».
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 sm:gap-6">
        <p className={cn(
          'text-4xl sm:text-5xl font-semibold tabular-nums leading-none',
          amountClass(horizon),
        )}>
          {horizonSigned}
        </p>
        <Sparkline points={sparkline} />
      </div>
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs uppercase tracking-wide">Actuel</dt>
          <dd className={cn('tabular-nums font-medium', amountClass(actuel))}>{formatEur(actuel)}</dd>
        </div>
        {unpointedCount > 0 && (
          <>
            <span aria-hidden className="text-border">·</span>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs uppercase tracking-wide">À pointer</dt>
              <dd className="text-foreground tabular-nums font-medium">
                {unpointedCount}{' '}
                <span className={cn('text-xs', amountClass(unpointedSum))}>({unpointedSigned})</span>
              </dd>
            </div>
          </>
        )}
        {recurringRemainingCount > 0 && (
          <>
            <span aria-hidden className="text-border">·</span>
            <div className="flex items-baseline gap-1.5">
              <dt className="text-xs uppercase tracking-wide">Récurrentes à venir</dt>
              <dd className="text-foreground tabular-nums font-medium">
                {recurringRemainingCount}{' '}
                <span className={cn('text-xs', amountClass(recurringRemainingSum))}>({recurringSigned})</span>
              </dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}

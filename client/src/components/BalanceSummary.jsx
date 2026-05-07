import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Vue globale, indépendante de la période.
// Actuel = Σ currentBalance des banques.
// Projeté = Σ projectedBalance (calculé serveur : currentBalance + toutes les
// non-pointées, sans cap de date).
// Total à pointer = projeté - actuel.
export default function BalanceSummary({ banks }) {
  const { current, projected, delta } = useMemo(() => {
    const totalCurrent = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
    const totalProjected = banks.reduce(
      (s, b) => s + (b.projectedBalance ?? b.currentBalance ?? 0),
      0,
    );
    return { current: totalCurrent, projected: totalProjected, delta: totalProjected - totalCurrent };
  }, [banks]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Wallet className="h-4 w-4 text-indigo-600" />
          Soldes
          <InfoTip>
            <strong>Actuel</strong> : somme des soldes courants saisis
            manuellement pour chaque banque. <strong>Projeté</strong> :
            actuel + somme des opérations non pointées (passées comme
            futures), indépendant de la période sélectionnée.
            {' '}<strong>Total à pointer</strong> : différence projeté −
            actuel, l'argent encore en attente de validation bancaire.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">global</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Cell label="Actuel" value={current} />
        <Cell label="Total à pointer" value={delta} signed />
        <Cell label="Projeté" value={projected} />
      </div>
    </div>
  );
}

function Cell({ label, value, signed }) {
  const fmt = (v) => (signed && v > 0 ? `+${formatEur(v)}` : formatEur(v));
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn(
        'mt-1 text-base font-bold tabular-nums',
        value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}>
        {fmt(value)}
      </div>
    </div>
  );
}

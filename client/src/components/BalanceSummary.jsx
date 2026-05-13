import { useMemo } from 'react';
import { Wallet } from 'lucide-react';
import { cn, formatEur, amountClass } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Vue globale, indépendante de la période.
// Actuel = Σ currentBalance des banques.
// Projeté = Σ projectedBalance (calculé serveur : currentBalance + toutes les
// non-pointées, sans cap de date).
// Total à pointer = projeté - actuel.
//
// Hiérarchie visuelle : le projeté est la "vérité opérationnelle" du produit
// (cf. PRODUCT.md Design Principle #1) — affiché en grand, signé.
// Actuel + À pointer restent visibles en second plan mais sans cliché
// hero-metric (DESIGN.md anti-references).
export default function BalanceSummary({ banks }) {
  const { current, projected, delta } = useMemo(() => {
    const totalCurrent = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
    const totalProjected = banks.reduce(
      (s, b) => s + (b.projectedBalance ?? b.currentBalance ?? 0),
      0,
    );
    return { current: totalCurrent, projected: totalProjected, delta: totalProjected - totalCurrent };
  }, [banks]);

  const deltaSigned = delta > 0 ? `+${formatEur(delta)}` : formatEur(delta);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          Solde projeté
          <InfoTip>
            <strong>Projeté</strong> : actuel + somme des opérations non
            pointées (passées comme futures), indépendant de la période
            sélectionnée. <strong>Actuel</strong> : somme des soldes courants
            saisis manuellement. <strong>À pointer</strong> : différence
            projeté − actuel, l'argent en attente de validation bancaire.
          </InfoTip>
        </h2>
        <p className="text-xs text-muted-foreground">global</p>
      </div>
      <p className={cn(
        'mt-2 text-3xl sm:text-4xl font-semibold tabular-nums leading-none',
        amountClass(projected),
      )}>
        {formatEur(projected)}
      </p>
      <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs uppercase tracking-wide">Actuel</dt>
          <dd className={cn('tabular-nums font-medium', amountClass(current))}>{formatEur(current)}</dd>
        </div>
        <span aria-hidden className="text-border">·</span>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-xs uppercase tracking-wide">À pointer</dt>
          <dd className={cn('tabular-nums font-medium', amountClass(delta))}>{deltaSigned}</dd>
        </div>
      </dl>
    </div>
  );
}

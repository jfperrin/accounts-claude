import { useMemo } from 'react';
import dayjs from 'dayjs';
import { Building2 } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';

// Cartes par banque pour la home : solde actuel + solde projeté à la fin de la
// période sélectionnée. Le projeté à fin de période = currentBalance + Σ amount
// des opérations non pointées dont date ≤ endDate (toutes banques confondues
// passées ou futures non encore réalisées).
//
// Différent de BankBalances utilisé sur /operations qui montre le projeté
// global (toutes les non-pointées, sans cap de date).
function projectedAt(bank, unpointed, endDate) {
  const cap = dayjs(endDate).endOf('day');
  const sum = unpointed
    .filter((o) => String(o.bankId?._id ?? o.bankId) === String(bank._id))
    .filter((o) => dayjs(o.date).isBefore(cap) || dayjs(o.date).isSame(cap))
    .reduce((s, o) => s + o.amount, 0);
  return (bank.currentBalance || 0) + sum;
}

export default function HomeBankCards({ banks, unpointed, endDate }) {
  const cards = useMemo(
    () => banks.map((b) => ({
      bank: b,
      projected: projectedAt(b, unpointed, endDate),
    })),
    [banks, unpointed, endDate],
  );

  const totalCurrent = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
  const totalProjected = cards.reduce((s, c) => s + c.projected, 0);

  return (
    <div className="grid grid-cols-1 gap-2 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {cards.map(({ bank, projected }) => (
        <div
          key={bank._id}
          className="rounded-xl border border-border bg-card shadow-xs p-4"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-indigo-600" />
            <span className="truncate">{bank.label}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Actuel</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatEur(bank.currentBalance ?? 0)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-border/60 pt-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Fin de période</span>
            <span className={cn(
              'text-lg font-bold tabular-nums',
              projected >= 0 ? 'text-emerald-600' : 'text-rose-600',
            )}>
              {formatEur(projected)}
            </span>
          </div>
        </div>
      ))}

      {banks.length > 1 && (
        <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
            Total
          </p>
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-wide text-indigo-200/80">Actuel</span>
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatEur(totalCurrent)}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-white/20 pt-2">
            <span className="text-xs uppercase tracking-wide text-indigo-200/80">Fin de période</span>
            <span className="text-lg font-extrabold tabular-nums text-white">
              {formatEur(totalProjected)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

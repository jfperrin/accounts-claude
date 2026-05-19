import { useMemo, useState } from 'react';
import { Check, CircleDashed, ChevronDown } from 'lucide-react';
import { cn, formatEur, amountClass } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import { buildTimelineItems } from '@/lib/timeline';

// Liste compacte des opérations non pointées (toutes dates), groupées par
// jour, avec un séparateur « À venir » avant les ops futur-datées.
//
// Tri date asc (ce qui arrive bientôt en premier) — l'utilisateur lit du
// haut vers le bas en suivant la chronologie.
const INITIAL_OP_LIMIT = 8;

export default function UnpointedOperationsList({ operations, onPoint }) {
  const [expanded, setExpanded] = useState(false);

  const allItems = useMemo(
    () => buildTimelineItems({ ops: operations, sortDir: 'asc' }),
    [operations],
  );

  const total = useMemo(
    () => operations.reduce((sum, op) => sum + op.amount, 0),
    [operations],
  );

  // Tronquage : on coupe par nombre d'OPS visibles (pas d'items), pour ne pas
  // afficher un day-header seul à la fin sans ligne.
  const { visibleItems, hiddenOpCount } = useMemo(() => {
    if (expanded) return { visibleItems: allItems, hiddenOpCount: 0 };
    const out = [];
    let count = 0;
    for (const it of allItems) {
      if (it.type === 'op') {
        if (count >= INITIAL_OP_LIMIT) break;
        out.push(it);
        count += 1;
      } else {
        out.push(it);
      }
    }
    // Si le dernier item visible est un day-header, on le retire.
    while (out.length && out[out.length - 1].type !== 'op') out.pop();
    return { visibleItems: out, hiddenOpCount: operations.length - count };
  }, [allItems, expanded, operations.length]);

  if (operations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Opérations non pointées</h2>
        </div>
        <EmptyState
          variant="card"
          icon={Check}
          title="Tout est pointé"
          description="Les opérations passées sont rapprochées du relevé bancaire."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between gap-2 px-2 sm:px-0">
        <h2 className="text-sm font-semibold">Opérations non pointées</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{operations.length}</span>
          <span className={cn('tabular-nums font-semibold', amountClass(total))}>
            {formatEur(total)}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visibleItems.map((it, idx) => {
          if (it.type === 'section') {
            return (
              <li
                key={`s-${idx}`}
                className="flex items-center gap-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                <span className="h-px flex-1 bg-primary/30" />
                {it.label}
                <span className="h-px flex-1 bg-primary/30" />
              </li>
            );
          }
          if (it.type === 'day') {
            return (
              <li
                key={`d-${idx}`}
                className="pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {it.label}
              </li>
            );
          }
          const op = it.op;
          return (
            <li
              key={op._id}
              className="flex items-center gap-3 py-2 px-1 sm:px-2"
            >
              <button
                type="button"
                onClick={() => onPoint(op._id)}
                aria-label="pointer"
                className="text-muted-foreground hover:text-credit transition-colors"
                title="Pointer"
              >
                <CircleDashed className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{op.label}</div>
                <div className="text-xs text-muted-foreground">
                  {op.bankId?.label ?? ''}
                </div>
              </div>
              <span className={cn('tabular-nums text-sm font-semibold whitespace-nowrap', amountClass(op.amount))}>
                {formatEur(op.amount)}
              </span>
            </li>
          );
        })}
      </ul>

      {hiddenOpCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Voir {hiddenOpCount} de plus
        </button>
      )}
      {expanded && operations.length > INITIAL_OP_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Réduire
        </button>
      )}
    </div>
  );
}

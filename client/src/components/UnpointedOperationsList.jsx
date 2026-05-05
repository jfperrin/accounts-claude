import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CircleDashed, ChevronDown } from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';

// Liste compacte des opérations non pointées (toutes dates).
// Les opérations futures sont surlignées (date > aujourd'hui).
// Triées par date croissante : ce qui arrive bientôt en premier.
const INITIAL_LIMIT = 8;

export default function UnpointedOperationsList({ operations, onPoint }) {
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(
    () => [...operations].sort((a, b) => a.date.localeCompare(b.date)),
    [operations],
  );

  const total = useMemo(
    () => sorted.reduce((sum, op) => sum + op.amount, 0),
    [sorted],
  );

  const today = dayjs().startOf('day');
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_LIMIT);
  const hidden = sorted.length - visible.length;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Opérations non pointées</h2>
        </div>
        <p className="text-sm text-muted-foreground">Tout est pointé.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between gap-2 px-2 sm:px-0">
        <h2 className="text-sm font-semibold">Opérations non pointées</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{sorted.length}</span>
          <span className={cn(
            'tabular-nums font-semibold',
            total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
            {formatEur(total)}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-border/60">
        {visible.map((op) => {
          const isFuture = dayjs(op.date).isAfter(today);
          return (
            <li
              key={op._id}
              className="flex items-center gap-3 py-2 px-1 sm:px-2"
            >
              <button
                type="button"
                onClick={() => onPoint(op._id)}
                aria-label="pointer"
                className="text-muted-foreground hover:text-emerald-600 transition-colors"
                title="Pointer"
              >
                <CircleDashed className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{op.label}</span>
                  {isFuture && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      à venir
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{dayjs(op.date).format('DD/MM/YYYY')}</span>
                  {op.bankId?.label && (
                    <>
                      <span>·</span>
                      <span className="truncate">{op.bankId.label}</span>
                    </>
                  )}
                </div>
              </div>
              <span className={cn(
                'tabular-nums text-sm font-semibold whitespace-nowrap',
                op.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}>
                {formatEur(op.amount)}
              </span>
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Voir {hidden} de plus
        </button>
      )}
      {expanded && sorted.length > INITIAL_LIMIT && (
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

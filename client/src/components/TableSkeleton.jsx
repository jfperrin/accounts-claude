import { Skeleton } from '@/components/ui/skeleton';

// Squelette générique de tableau pendant le chargement initial d'une liste.
// `rows` = nombre de lignes affichées, `cols` = largeurs Tailwind (ex. ['w-40','w-24','w-16']).
// Rendu mobile-friendly : empilage de blocs sur sm-, ligne horizontale sur sm+.
export default function TableSkeleton({ rows = 5, cols = ['w-40', 'w-24', 'w-16'] }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Chargement en cours"
      className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="hidden gap-4 border-b border-border pb-2 sm:flex">
        {cols.map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex flex-col gap-2 border-b border-border/60 py-2 last:border-b-0 sm:flex-row sm:items-center sm:gap-4"
        >
          {cols.map((w, c) => (
            <Skeleton key={c} className={`h-4 ${w}`} />
          ))}
        </div>
      ))}
      <span className="sr-only">Chargement en cours…</span>
    </div>
  );
}

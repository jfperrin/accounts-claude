// Placeholder utilisé en fallback Suspense pour les graphes recharts lazy-loadés.
// Match la hauteur du graphe rendu pour éviter le saut de layout au chargement.
export default function ChartFallback({ height = 240 }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="animate-pulse rounded-xl border border-border bg-muted/50 shadow-xs"
      style={{ height }}
    />
  );
}

import { cn } from '@/lib/utils';

// Bloc placeholder neutre tinté + pulse subtil. Pas de shimmer (cf. DESIGN.md
// Anti-references : pas de gradient animé décoratif). Utiliser des dimensions
// explicites (h-X w-X) ou une largeur full pour reproduire la forme du contenu.
export function Skeleton({ className, ...props }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

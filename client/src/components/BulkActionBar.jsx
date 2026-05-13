import { Check, X, Tag, Trash2, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Barre flottante d'actions de masse sur les opérations sélectionnées.
// Affichée en bas centrée tant qu'au moins une opération est sélectionnée.
// Aligne sobre / flat-by-default (DESIGN.md) : carte bg-card + shadow-xs,
// l'accent primary reste sur l'effet de focus et le compteur, pas sur le fond.
export default function BulkActionBar({
  count, onPoint, onUnpoint, onCategorize, onDelete, onCancel,
}) {
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Actions de masse"
      className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-3 md:bottom-6"
    >
      <div className="flex w-full max-w-2xl items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-xs">
        <span className="px-2 text-sm font-semibold tabular-nums">
          <span className="text-primary">{count}</span>
          <span className="text-muted-foreground"> sélectionnée{count > 1 ? 's' : ''}</span>
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onPoint}>
            <Check className="h-4 w-4" />
            <span className="hidden sm:inline">Pointer</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onUnpoint}>
            <MinusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Dépointer</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCategorize}>
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Catégoriser…</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Supprimer</span>
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Annuler la sélection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

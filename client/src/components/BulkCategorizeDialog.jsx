import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import CategoryBadge from '@/components/CategoryBadge';
import { cn, formatEur } from '@/lib/utils';

// Modale qui propose d'appliquer une catégorie à des opérations similaires sans
// catégorie. Toutes les cases sont cochées par défaut.
export default function BulkCategorizeDialog({
  open, candidates = [], categoryId, categories = [], onConfirm, onCancel,
}) {
  const [selected, setSelected] = useState(() => new Set(candidates.map((c) => c._id)));

  // Reset à chaque réouverture / changement de candidats.
  useEffect(() => {
    if (open) setSelected(new Set(candidates.map((c) => c._id)));
  }, [open, candidates]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChecked = selected.size === candidates.length;
  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(candidates.map((c) => c._id)));
  };

  const handleConfirm = () => onConfirm([...selected]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Appliquer la catégorie aux opérations similaires&nbsp;?</DialogTitle>
        </DialogHeader>

        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Catégorie&nbsp;:</span>
            <CategoryBadge categoryId={categoryId} categories={categories} />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {candidates.length} opération{candidates.length > 1 ? 's' : ''} sans catégorie
              au libellé similaire.
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {allChecked ? 'Tout décocher' : 'Tout cocher'}
            </button>
          </div>

          <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
            {candidates.map((c) => {
              const checked = selected.has(c._id);
              const id = `bulk-cat-${c._id}`;
              return (
                <label
                  key={c._id}
                  htmlFor={id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition',
                    checked
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-transparent bg-background hover:bg-accent',
                  )}
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c._id)}
                    className="h-4 w-4 shrink-0 accent-indigo-600"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className={cn(
                    'tabular-nums shrink-0',
                    c.amount < 0 ? 'text-rose-600' : 'text-emerald-600',
                  )}>
                    {c.amount > 0 ? '+' : ''}{formatEur(c.amount)}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {dayjs(c.date).format('DD/MM/YYYY')}
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Ignorer</Button>
          <Button type="button" onClick={handleConfirm} disabled={selected.size === 0}>
            Appliquer ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

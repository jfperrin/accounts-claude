import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatEur } from '@/lib/utils';

// Modale de résolution des conflits d'import.
// Affiche chaque ligne de fichier ambigüe avec ses candidats existants ;
// l'utilisateur coche les opérations à pointer (et à suffixer du libellé du fichier).
// Aucune coche → la ligne est insérée telle quelle.
//
// Props:
//   open            : boolean
//   pendingMatches  : Array<{ importedRow: {...}, candidates: Array<{...}> }>
//   onResolve(resolutions) : appelée avec les choix [{ importedRow, selectedOpIds }]
//   onCancel()      : ferme la modale sans rien envoyer
export default function ImportResolveDialog({ open, pendingMatches, onResolve, onCancel }) {
  // Map<csvIndex, Set<opId>> — sélections par ligne de fichier
  const [selections, setSelections] = useState(new Map());

  // Reset à chaque ouverture pour ne pas garder l'état d'un import précédent
  useEffect(() => {
    if (open) setSelections(new Map());
  }, [open, pendingMatches]);

  const toggle = (csvIndex, opId) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(csvIndex) || []);
      if (set.has(opId)) set.delete(opId);
      else set.add(opId);
      next.set(csvIndex, set);
      return next;
    });
  };

  const handleConfirm = () => {
    const resolutions = pendingMatches.map((m, i) => ({
      importedRow: m.importedRow,
      selectedOpIds: Array.from(selections.get(i) || []),
    }));
    onResolve(resolutions);
  };

  if (!pendingMatches || pendingMatches.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {pendingMatches.length} conflit(s) à résoudre
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Plusieurs opérations existantes correspondent au montant de ces lignes
          du fichier. Coche celles à pointer — leur libellé sera enrichi du
          libellé du fichier entre parenthèses. Aucune coche = la ligne est
          ajoutée telle quelle.
        </p>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {pendingMatches.map((m, i) => {
            const sel = selections.get(i) || new Set();
            return (
              <div key={i} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-semibold">{m.importedRow.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {dayjs(m.importedRow.date).format('DD/MM/YYYY')}
                    </span>
                  </div>
                  <span className={cn(
                    'text-sm font-bold tabular-nums',
                    m.importedRow.amount < 0 ? 'text-rose-600' : 'text-emerald-600',
                  )}>
                    {m.importedRow.amount > 0 ? '+' : ''}{formatEur(m.importedRow.amount)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {m.candidates.map((c) => {
                    const checked = sel.has(c._id);
                    const id = `match-${i}-${c._id}`;
                    return (
                      <label
                        key={c._id}
                        htmlFor={id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm transition',
                          checked
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-border bg-background hover:bg-accent',
                        )}
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(i, c._id)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="flex-1 truncate">{c.label}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {dayjs(c.date).format('DD/MM/YYYY')}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button type="button" onClick={handleConfirm}>Appliquer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

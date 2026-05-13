import { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { previewRecurring } from '@/api/operations';
import { cn, formatEur, amountClass } from '@/lib/utils';

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const currentYear = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function GenerateRecurringDialog({ open, onConfirm, onCancel, recurring = [] }) {
  const today = dayjs();
  const [month, setMonth] = useState(String(today.month() + 1));
  const [year, setYear] = useState(String(today.year()));
  const [previewById, setPreviewById] = useState({}); // recurringId -> { date, alreadyImported }
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);

  // Recharge l'aperçu serveur à chaque changement de mois/année (ou ouverture).
  // Initialise la sélection : tout coché sauf les déjà-importées.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    previewRecurring({ month: Number(month), year: Number(year) })
      .then(({ items }) => {
        if (cancelled) return;
        const map = {};
        const ids = new Set();
        for (const it of items) {
          map[it.recurringId] = it;
          if (!it.alreadyImported) ids.add(it.recurringId);
        }
        setPreviewById(map);
        setSelected(ids);
      })
      .catch(() => { if (!cancelled) setPreviewById({}); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, month, year]);

  const sortedRecurring = useMemo(() => {
    const arr = [...recurring];
    arr.sort((a, b) => (a.dayOfMonth - b.dayOfMonth) || a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
    return arr;
  }, [recurring]);

  const eligibleIds = useMemo(
    () => sortedRecurring.filter((r) => !previewById[String(r._id)]?.alreadyImported).map((r) => String(r._id)),
    [sortedRecurring, previewById],
  );
  const allEligibleChecked = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allEligibleChecked) setSelected(new Set());
    else setSelected(new Set(eligibleIds));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      month: Number(month),
      year: Number(year),
      recurringIds: Array.from(selected),
    });
  };

  const empty = recurring.length === 0;
  const canSubmit = selected.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Générer les opérations récurrentes</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mois</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((label, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Année</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {empty ? (
            <p className="text-sm text-muted-foreground">Aucune récurrente à générer.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selected.size} / {sortedRecurring.length} sélectionnée(s)
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleAll}
                  disabled={loading || eligibleIds.length === 0}
                >
                  {allEligibleChecked ? 'Tout décocher' : 'Tout cocher'}
                </Button>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {sortedRecurring.map((r) => {
                  const id = String(r._id);
                  const info = previewById[id];
                  const already = info?.alreadyImported;
                  const date = info?.date ? dayjs(info.date).format('DD/MM/YYYY') : '—';
                  const checked = selected.has(id);
                  return (
                    <label
                      key={id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50',
                        already && 'opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary cursor-pointer"
                        checked={checked}
                        onChange={() => toggle(id)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                          {r.toBankId && <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
                          <span className="truncate">{r.label || (r.toBankId ? 'Virement' : '—')}</span>
                          {already && <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">déjà importée</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {date} · {r.bankId?.label ?? '—'}
                        </div>
                      </div>
                      <span className={cn('text-sm font-semibold shrink-0', amountClass(r.amount))}>
                        {r.amount > 0 ? '+' : ''}{formatEur(r.amount)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit" disabled={!canSubmit}>
              Générer{selected.size > 0 ? ` (${selected.size})` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

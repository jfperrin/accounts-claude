import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import CategorySelectItems from '@/components/CategorySelectItems';

export default function MakeRecurringDialog({ open, form, banks, categories, onChange, onSubmit, onCancel }) {
  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Créer une opération récurrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="rec-label">Libellé</Label>
            <input
              id="rec-label"
              value={form.label}
              onChange={(e) => onChange('label', e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jour du mois</Label>
              <Select value={form.dayOfMonth} onValueChange={(v) => onChange('dayOfMonth', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Montant (€)</Label>
              <input
                id="rec-amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => onChange('amount', e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Banque</Label>
            <Select value={form.bankId} onValueChange={(v) => onChange('bankId', v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.categoryId} onValueChange={(v) => onChange('categoryId', v)}>
              <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sans catégorie</SelectItem>
                <CategorySelectItems categories={categories} />
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit" disabled={!form.bankId}>Créer la récurrente</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

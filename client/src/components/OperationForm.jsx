import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DEFAULT_COLOR } from '@/lib/categoryColors';

const empty = () => ({ label: '', bankId: '', date: dayjs().format('YYYY-MM-DD'), amount: '', categoryId: '' });

export default function OperationForm({ open, operation, banks, categories = [], onFinish, onCancel }) {
  const [form, setForm] = useState(empty());

  useEffect(() => {
    if (open) {
      setForm(operation
        ? {
            label: operation.label,
            bankId: operation.bankId?._id ?? operation.bankId ?? '',
            date: dayjs(operation.date).format('YYYY-MM-DD'),
            amount: String(operation.amount),
            categoryId: operation.categoryId ?? '',
          }
        : empty()
      );
    }
  }, [open, operation]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.label || !form.bankId || !form.date || form.amount === '') return;
    onFinish({
      label: form.label,
      bankId: form.bankId,
      date: new Date(form.date).toISOString(),
      amount: parseFloat(form.amount),
      categoryId: form.categoryId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{operation ? "Modifier l'opération" : 'Nouvelle opération'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="op-label">Libellé</Label>
            <Input id="op-label" autoFocus value={form.label} onChange={set('label')} required />
          </div>

          <div className="space-y-1.5">
            <Label>Banque</Label>
            <Select value={form.bankId} onValueChange={(v) => setForm((f) => ({ ...f, bankId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une banque" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-date">Date</Label>
            <Input id="op-date" type="date" value={form.date} onChange={set('date')} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-amount">Montant (€, négatif = débit)</Label>
            <Input
              id="op-amount"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sans catégorie</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? DEFAULT_COLOR }} />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
import CategorySelectItems from '@/components/CategorySelectItems';
import DebitCreditToggle from '@/components/DebitCreditToggle';

const empty = () => ({ label: '', bankId: '', date: dayjs().format('YYYY-MM-DD'), amount: '', kind: 'debit', categoryId: '' });

export default function OperationForm({ open, operation, banks, categories = [], onFinish, onCancel }) {
  const [form, setForm] = useState(empty());
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(operation
        ? {
            label: operation.label,
            bankId: operation.bankId?._id ?? operation.bankId ?? '',
            date: dayjs(operation.date).format('YYYY-MM-DD'),
            amount: String(Math.abs(operation.amount)),
            kind: operation.amount < 0 ? 'debit' : 'credit',
            categoryId: operation.categoryId ?? '',
          }
        : empty()
      );
    }
  }, [open, operation]);

  const set = (key) => (e) => {
    const value = e.target?.value ?? e;
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.label.trim()) next.label = 'Libellé requis.';
    if (!form.bankId) next.bankId = 'Banque requise.';
    if (!form.date) next.date = 'Date requise.';
    if (form.amount === '' || Number.isNaN(parseFloat(form.amount))) next.amount = 'Montant requis.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const abs = Math.abs(parseFloat(form.amount));
    onFinish({
      label: form.label,
      bankId: form.bankId,
      date: new Date(form.date).toISOString(),
      amount: form.kind === 'debit' ? -abs : abs,
      categoryId: form.categoryId || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{operation ? "Modifier l'opération" : 'Nouvelle opération'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="op-label">Libellé</Label>
            <Input
              id="op-label"
              autoFocus
              value={form.label}
              onChange={set('label')}
              aria-invalid={!!errors.label}
              aria-describedby={errors.label ? 'op-label-error' : undefined}
            />
            {errors.label && (
              <p id="op-label-error" role="alert" className="text-xs text-destructive">{errors.label}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-bank">Banque</Label>
            <Select
              value={form.bankId}
              onValueChange={(v) => {
                setForm((f) => ({ ...f, bankId: v }));
                if (errors.bankId) setErrors((p) => ({ ...p, bankId: undefined }));
              }}
            >
              <SelectTrigger
                id="op-bank"
                aria-invalid={!!errors.bankId}
                aria-describedby={errors.bankId ? 'op-bank-error' : undefined}
              >
                <SelectValue placeholder="Sélectionner une banque" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bankId && (
              <p id="op-bank-error" role="alert" className="text-xs text-destructive">{errors.bankId}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-date">Date</Label>
            <Input
              id="op-date"
              type="date"
              value={form.date}
              onChange={set('date')}
              aria-invalid={!!errors.date}
              aria-describedby={errors.date ? 'op-date-error' : undefined}
            />
            {errors.date && (
              <p id="op-date-error" role="alert" className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="op-amount">Montant (€)</Label>
            <div className="flex gap-2">
              <DebitCreditToggle
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                className="w-auto shrink-0"
              />
              <Input
                id="op-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={set('amount')}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'op-amount-error' : undefined}
              />
            </div>
            {errors.amount && (
              <p id="op-amount-error" role="alert" className="text-xs text-destructive">{errors.amount}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sans catégorie</SelectItem>
                <CategorySelectItems categories={categories} />
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

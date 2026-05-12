import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const emptyForm = () => ({
  fromBankId: '',
  toBankId: '',
  amount: '',
  date: dayjs().format('YYYY-MM-DD'),
  label: '',
});

export default function TransferDialog({ open, banks, onFinish, onCancel }) {
  const [form, setForm] = useState(emptyForm());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setForm(emptyForm()); setErrors({}); setSaving(false); }
  }, [open]);

  const set = (key) => (v) => {
    setForm((f) => ({ ...f, [key]: v?.target?.value ?? v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.fromBankId) next.fromBankId = 'Banque source requise.';
    if (!form.toBankId) next.toBankId = 'Banque destination requise.';
    if (form.fromBankId && form.toBankId && form.fromBankId === form.toBankId) {
      next.toBankId = 'Doit être différente de la source.';
    }
    const amt = parseFloat(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) next.amount = 'Montant positif requis.';
    if (!form.date) next.date = 'Date requise.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await onFinish({
        fromBankId: form.fromBankId,
        toBankId: form.toBankId,
        amount: Math.abs(amt),
        date: new Date(form.date).toISOString(),
        label: form.label.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Virement interne</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="tr-from">De</Label>
              <Select value={form.fromBankId} onValueChange={set('fromBankId')}>
                <SelectTrigger id="tr-from" aria-invalid={!!errors.fromBankId}><SelectValue placeholder="Source" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="space-y-1.5">
              <Label htmlFor="tr-to">Vers</Label>
              <Select value={form.toBankId} onValueChange={set('toBankId')}>
                <SelectTrigger id="tr-to" aria-invalid={!!errors.toBankId}><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(errors.fromBankId || errors.toBankId) && (
            <p role="alert" className="text-xs text-destructive">{errors.fromBankId || errors.toBankId}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tr-amount">Montant (€)</Label>
              <Input
                id="tr-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={set('amount')}
                aria-invalid={!!errors.amount}
              />
              {errors.amount && <p role="alert" className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-date">Date</Label>
              <Input id="tr-date" type="date" value={form.date} onChange={set('date')} aria-invalid={!!errors.date} />
              {errors.date && <p role="alert" className="text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tr-label">Libellé (optionnel)</Label>
            <Input
              id="tr-label"
              value={form.label}
              onChange={set('label')}
              placeholder="Virement → … / Virement ← …"
            />
            <p className="text-xs text-muted-foreground">Laisser vide pour un libellé automatique sur chaque ligne.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

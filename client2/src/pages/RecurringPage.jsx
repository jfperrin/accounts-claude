import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/recurringOperations';
import * as banksApi from '@/api/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const fmtEur = (v) => v?.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const empty = () => ({ label: '', bankId: '', dayOfMonth: '', amount: '' });

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { item? }
  const [form, setForm] = useState(empty());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => Promise.all([api.list(), banksApi.list()]).then(([ops, b]) => { setItems(ops); setBanks(b); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty()); setModal({}); };
  const openEdit = (item) => {
    setForm({
      label: item.label,
      bankId: item.bankId?._id ?? item.bankId ?? '',
      dayOfMonth: String(item.dayOfMonth),
      amount: String(item.amount),
    });
    setModal({ item });
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val?.target?.value ?? val }));

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        label: form.label,
        bankId: form.bankId,
        dayOfMonth: Number(form.dayOfMonth),
        amount: parseFloat(form.amount),
      };
      modal.item ? await api.update(modal.item._id, payload) : await api.create(payload);
      toast.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    await api.remove(deleteTarget);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Opérations récurrentes</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Banque</TableHead>
              <TableHead className="text-center">Jour</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item._id}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell><Badge variant="secondary">{item.bankId?.label}</Badge></TableCell>
                <TableCell className="text-center text-muted-foreground">{item.dayOfMonth}</TableCell>
                <TableCell className={cn('text-right font-semibold', item.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                  {item.amount > 0 ? '+' : ''}{fmtEur(item.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="supprimer"
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(item._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.item ? 'Modifier' : 'Nouvelle opération récurrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rec-label">Libellé</Label>
              <Input id="rec-label" autoFocus value={form.label} onChange={set('label')} required />
            </div>
            <div className="space-y-1.5">
              <Label>Banque</Label>
              <Select value={form.bankId} onValueChange={set('bankId')}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jour du mois</Label>
                <Select value={form.dayOfMonth} onValueChange={set('dayOfMonth')}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-amount">Montant (€)</Label>
                <Input id="rec-amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Supprimer ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={onDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

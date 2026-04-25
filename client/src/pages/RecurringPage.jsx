import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Download } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as api from '@/api/recurringOperations';
import * as banksApi from '@/api/banks';
import * as operationsApi from '@/api/operations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, formatEur } from '@/lib/utils';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);
const empty = () => ({ label: '', bankId: '', dayOfMonth: '', amount: '' });

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { item? }
  const [form, setForm] = useState(empty());
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Boîte de dialogue de génération : on demande mois/année avant d'appeler le serveur.
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(dayjs().month() + 1);
  const [genYear, setGenYear] = useState(CURRENT_YEAR);

  const load = () => Promise.all([api.list(), banksApi.list()]).then(([ops, b]) => { setItems([...ops].sort((a, b) => a.dayOfMonth - b.dayOfMonth)); setBanks(b); });
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
    try {
      await api.remove(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const onGenerate = async (e) => {
    e.preventDefault();
    try {
      const { imported } = await operationsApi.generateRecurring({ month: genMonth, year: genYear });
      toast.success(`${imported} opération(s) générée(s) pour ${MONTHS[genMonth - 1]} ${genYear}`);
      setGenOpen(false);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la génération');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-foreground">Opérations récurrentes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Générer pour un mois
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
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
                  {item.amount > 0 ? '+' : ''}{formatEur(item.amount)}
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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ?"
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Dialog open={genOpen} onOpenChange={(o) => !o && setGenOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Générer les récurrentes</DialogTitle>
          </DialogHeader>
          <form onSubmit={onGenerate} className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Crée les opérations correspondant aux récurrentes ci-dessus pour le mois choisi.
              Les doublons (même libellé, banque, montant, date) sont ignorés.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mois</Label>
                <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
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
                <Select value={String(genYear)} onValueChange={(v) => setGenYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>Annuler</Button>
              <Button type="submit">Générer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

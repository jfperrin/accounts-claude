import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { list, create, update, remove } from '@/api/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatEur } from '@/lib/utils';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

export default function BanksPage() {
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { bank? }
  const [label, setLabel] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => list().then(setBanks);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setLabel(''); setCurrentBalance(''); setModal({}); };
  const openEdit = (bank) => {
    setLabel(bank.label);
    setCurrentBalance(String(bank.currentBalance ?? 0));
    setModal({ bank });
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        label,
        currentBalance: currentBalance === '' ? 0 : parseFloat(currentBalance),
      };
      modal.bank ? await update(modal.bank._id, payload) : await create(payload);
      toast.success('Enregistré');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    try {
      await remove(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Banques</h1>
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
              <TableHead className="text-right">Solde actuel</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.map((bank) => (
              <TableRow key={bank._id}>
                <TableCell className="font-medium">{bank.label}</TableCell>
                <TableCell className="text-right text-muted-foreground">{formatEur(bank.currentBalance ?? 0)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(bank)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="supprimer"
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(bank._id)}>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal?.bank ? 'Modifier la banque' : 'Nouvelle banque'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="bank-label">Libellé</Label>
              <Input id="bank-label" autoFocus value={label} onChange={(e) => setLabel(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bank-balance">Solde actuel (€)</Label>
              <Input
                id="bank-balance"
                type="number"
                step="0.01"
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Solde affiché par la banque, base du prévisionnel.</p>
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
        title="Supprimer la banque ?"
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

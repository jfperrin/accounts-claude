import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/banks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export default function BanksPage() {
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { bank? }
  const [label, setLabel] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => api.list().then(setBanks);
  useEffect(() => { load(); }, []);

  const openAdd = () => { setLabel(''); setModal({}); };
  const openEdit = (bank) => { setLabel(bank.label); setModal({ bank }); };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      modal.bank ? await api.update(modal.bank._id, { label }) : await api.create({ label });
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
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {banks.map((bank) => (
              <TableRow key={bank._id}>
                <TableCell className="font-medium">{bank.label}</TableCell>
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

      {/* Add/Edit dialog */}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la banque ?</DialogTitle>
          </DialogHeader>
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

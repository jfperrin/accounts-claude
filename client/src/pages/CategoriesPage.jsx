import { useState } from 'react';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import * as api from '@/api/categories';
import { useCategories } from '@/hooks/useCategories';
import { CATEGORY_COLORS, DEFAULT_COLOR } from '@/lib/categoryColors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

export default function CategoriesPage() {
  const { categories, reload } = useCategories();
  const [modal, setModal] = useState(null); // null | { cat? }
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAdd = () => { setLabel(''); setColor(DEFAULT_COLOR); setModal({}); };
  const openEdit = (cat) => { setLabel(cat.label); setColor(cat.color ?? DEFAULT_COLOR); setModal({ cat }); };

  const onSave = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      if (modal.cat) {
        await api.update(modal.cat._id, { label: label.trim(), color });
      } else {
        await api.create({ label: label.trim(), color });
      }
      toast.success('Enregistré');
      setModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    try {
      await api.remove(deleteTarget);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Catégories</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Les catégories permettent de classer vos opérations. Elles sont assignables depuis la liste des opérations et les récurrentes.
      </p>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Tag className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Aucune catégorie</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat._id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color ?? DEFAULT_COLOR }}
                      />
                      {cat.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(cat)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="supprimer"
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(cat._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal?.cat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="cat-label">Libellé</Label>
              <Input
                id="cat-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                    aria-label={c}
                  />
                ))}
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
        title="Supprimer la catégorie ?"
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

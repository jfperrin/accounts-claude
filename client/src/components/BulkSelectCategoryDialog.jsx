import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CategorySelectItems from '@/components/CategorySelectItems';

// Modal simple : choisir une catégorie à appliquer aux N opérations sélectionnées.
// "none" = retirer la catégorie (mappé null côté API ; le backend bulk-categorize
// exige un categoryId — on ne propose donc pas "none" ici, l'utilisateur passe
// par le menu inline pour décatégoriser).
export default function BulkSelectCategoryDialog({
  open, count, categories = [], onConfirm, onCancel,
}) {
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => { if (open) setCategoryId(''); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Catégoriser {count} opération{count > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger aria-label="Choisir une catégorie">
              <SelectValue placeholder="Choisir une catégorie…" />
            </SelectTrigger>
            <SelectContent>
              <CategorySelectItems categories={categories} />
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
          <Button
            type="button"
            disabled={!categoryId}
            onClick={() => onConfirm(categoryId)}
          >
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

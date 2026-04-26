import { useState, useMemo, useEffect } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatEur } from '@/lib/utils';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

const PAGE_SIZES = [20, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

export default function OperationsTable({ operations, categories = [], onPoint, onEdit, onDelete, onCategoryChange }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // Tri décroissant : opérations les plus récentes en haut.
  const sorted = useMemo(
    () => [...operations].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [operations]
  );

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Si la page courante dépasse le nombre de pages (après suppression d'op,
  // changement de mois, ou augmentation de pageSize), on revient à la dernière.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const start = (page - 1) * pageSize;
  const rows = sorted.slice(start, start + pageSize);

  const confirmDelete = () => {
    onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Banque</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="text-center">Pointé</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((op) => (
            <TableRow
              key={op._id}
              className={cn(op.pointed && 'opacity-50', 'md:cursor-default cursor-pointer active:opacity-70')}
              onClick={(e) => {
                // Sur mobile uniquement : clic sur la ligne pointe/dépointe
                if (window.innerWidth < 768 && !e.target.closest('button, [role="switch"], [role="combobox"]')) {
                  onPoint(op._id);
                }
              }}
            >
              <TableCell className="text-muted-foreground">{dayjs(op.date).format('DD/MM/YYYY')}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{op.label}</span>
                  {onCategoryChange && (
                    <Select
                      value={op.category ?? 'none'}
                      onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-6 w-36 border-dashed text-xs text-muted-foreground">
                        <SelectValue placeholder="Catégorie…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sans catégorie</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c._id} value={c.label}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{op.bankId?.label}</Badge>
              </TableCell>
              <TableCell className={cn('text-right font-semibold', op.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
              </TableCell>
              <TableCell className="text-center">
                <Switch checked={op.pointed} onCheckedChange={() => onPoint(op._id)} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => onEdit(op)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="supprimer" onClick={() => setDeleteTarget(op._id)}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination — toujours visible (le sélecteur de taille reste utile même
          quand il n'y a qu'une seule page). */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Lignes par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
          >
            <SelectTrigger className="h-8 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {total === 0 ? '0' : `${start + 1}–${Math.min(start + pageSize, total)} sur ${total}`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="page précédente"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="page suivante"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'opération ?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatEur } from '@/lib/utils';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
const ROWS_PER_PAGE = 20;

export default function OperationsTable({ operations, onPoint, onEdit, onDelete }) {
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  useEffect(() => { setPage(1); }, [operations]);

  const sorted = useMemo(
    () => [...operations].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [operations]
  );
  const totalPages = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const rows = sorted.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

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
                // On ignore si le clic vient d'un bouton/switch (desktop actions)
                if (window.innerWidth < 768 && !e.target.closest('button, [role="switch"]')) {
                  onPoint(op._id);
                }
              }}
            >
              <TableCell className="text-muted-foreground">{dayjs(op.date).format('DD/MM/YYYY')}</TableCell>
              <TableCell className="font-medium">{op.label}</TableCell>
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'opération ?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

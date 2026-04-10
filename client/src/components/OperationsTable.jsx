import { useState, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatEur } from '@/lib/utils';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

export default function OperationsTable({ operations, onPoint, onEdit, onDelete }) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const rows = useMemo(
    () => [...operations].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [operations]
  );

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

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer l'opération ?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

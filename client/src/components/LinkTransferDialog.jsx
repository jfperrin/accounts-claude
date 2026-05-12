import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Link as LinkIcon } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { list as listOps, linkTransfer } from '@/api/operations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, formatEur } from '@/lib/utils';

// Dialog de liaison manuelle : on cherche dans une fenêtre temporelle large
// (±30 j) les ops de l'autre banque qui ont le montant exactement opposé et
// qui ne sont pas déjà liées à un virement. L'utilisateur pick la bonne.
export default function LinkTransferDialog({ open, sourceOp, onClose, onLinked }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !sourceOp) return;
    setLoading(true);
    setFilter('');
    const start = dayjs(sourceOp.date).subtract(30, 'day').format('YYYY-MM-DD');
    const end = dayjs(sourceOp.date).add(30, 'day').format('YYYY-MM-DD');
    listOps({ startDate: start, endDate: end })
      .then((all) => {
        const sourceBankId = String(sourceOp.bankId?._id ?? sourceOp.bankId);
        const targetCents = -Math.round(Number(sourceOp.amount) * 100);
        const filtered = all.filter((o) => {
          if (String(o._id) === String(sourceOp._id)) return false;
          if (o.transferId) return false;
          const bid = String(o.bankId?._id ?? o.bankId);
          if (bid === sourceBankId) return false;
          return Math.round(Number(o.amount) * 100) === targetCents;
        });
        filtered.sort((a, b) => Math.abs(dayjs(a.date).diff(sourceOp.date)) - Math.abs(dayjs(b.date).diff(sourceOp.date)));
        setCandidates(filtered);
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, [open, sourceOp]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return candidates;
    return candidates.filter((o) =>
      o.label.toLowerCase().includes(needle)
      || o.bankId?.label?.toLowerCase().includes(needle),
    );
  }, [candidates, filter]);

  const confirm = async (otherId) => {
    setSubmitting(true);
    try {
      await linkTransfer(sourceOp._id, otherId);
      toast.success('Virement interbanque créé');
      onLinked?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la liaison');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lier comme virement interbanque</DialogTitle>
        </DialogHeader>

        {sourceOp && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{sourceOp.bankId?.label}</Badge>
              <span>{dayjs(sourceOp.date).format('DD/MM/YYYY')}</span>
              <span className={cn('ml-auto tabular-nums font-semibold', sourceOp.amount < 0 ? 'text-debit' : 'text-credit')}>
                {formatEur(sourceOp.amount)}
              </span>
            </div>
            <div className="mt-0.5 truncate font-medium">{sourceOp.label}</div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Sélectionne la jambe opposée sur une autre banque. Seules les
          opérations au montant exactement opposé (±30 j) et non encore
          liées à un virement sont proposées.
        </p>

        <Input
          type="search"
          placeholder="Filtrer par libellé ou banque"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-1"
        />

        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Recherche…</p>
          ) : visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune opération candidate.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((o) => (
                <li key={o._id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{o.bankId?.label}</Badge>
                      <span>{dayjs(o.date).format('DD/MM/YYYY')}</span>
                      <span className={cn('ml-auto tabular-nums font-semibold', o.amount < 0 ? 'text-debit' : 'text-credit')}>
                        {formatEur(o.amount)}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium">{o.label}</div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => confirm(o._id)}
                    disabled={submitting}
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Lier
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

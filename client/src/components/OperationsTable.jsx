import { useState, useMemo, useEffect, useRef } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Repeat, Repeat2 } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatEur } from '@/lib/utils';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import CategoryBadge from '@/components/CategoryBadge';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

const DELETE_REVEAL = 88;
const EDIT_REVEAL = 160;
const DRAG_THRESHOLD = 6;

function SwipeableCard({ op, onPoint, onEdit, onDelete, onMakeRecurring, children }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const draggingRef = useRef(false);
  const axis = useRef(null);

  const onPointerDown = (e) => {
    if (e.target.closest('button, [role="switch"], [role="combobox"]')) return;
    startX.current = e.clientX;
    startOffset.current = offset;
    draggingRef.current = true;
    setDragging(true);
    moved.current = false;
    axis.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - startX.current;
    if (!axis.current && Math.abs(dx) > DRAG_THRESHOLD) {
      axis.current = 'h';
      moved.current = true;
    }
    if (axis.current !== 'h') return;
    let next = startOffset.current + dx;
    next = Math.max(-DELETE_REVEAL, Math.min(EDIT_REVEAL, next));
    setOffset(next);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (offset > EDIT_REVEAL / 2) setOffset(EDIT_REVEAL);
    else if (offset < -DELETE_REVEAL / 2) setOffset(-DELETE_REVEAL);
    else setOffset(0);
    setTimeout(() => { moved.current = false; }, 0);
  };

  const handleClick = (e) => {
    if (moved.current) { e.stopPropagation(); return; }
    if (offset !== 0) { setOffset(0); e.stopPropagation(); return; }
    if (!e.target.closest('button, [role="switch"], [role="combobox"]')) {
      onPoint(op._id);
    }
  };

  const close = () => setOffset(0);

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 left-0 flex">
        <button
          type="button"
          onClick={() => { close(); onEdit(op); }}
          className="flex flex-col items-center justify-center gap-0.5 bg-indigo-500 px-3 text-white text-[10px] font-medium"
          style={{ width: EDIT_REVEAL / 2 }}
        >
          <Pencil className="h-4 w-4" />
          Éditer
        </button>
        {onMakeRecurring && (
          <button
            type="button"
            onClick={() => { close(); onMakeRecurring(op); }}
            className="flex flex-col items-center justify-center gap-0.5 bg-violet-500 px-3 text-white text-[10px] font-medium"
            style={{ width: EDIT_REVEAL / 2 }}
          >
            <Repeat2 className="h-4 w-4" />
            Récurrente
          </button>
        )}
      </div>
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => { close(); onDelete(op._id); }}
          className="flex flex-col items-center justify-center gap-0.5 bg-rose-600 px-3 text-white text-[10px] font-medium"
          style={{ width: DELETE_REVEAL }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </button>
      </div>
      <div
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
          touchAction: 'pan-y',
        }}
        className={cn(
          'relative border border-border px-2 py-2 cursor-pointer',
          op.pointed ? 'bg-muted text-muted-foreground' : 'bg-card',
        )}
      >
        {children}
      </div>
    </div>
  );
}

const PAGE_SIZES = [20, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;

export default function OperationsTable({ operations, categories = [], recurring = [], onPoint, onEdit, onDelete, onCategoryChange, onMakeRecurring }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  // Tri décroissant : opérations les plus récentes en haut.
  const sorted = useMemo(
    () => [...operations].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [operations]
  );

  // Match heuristique op ↔ récurrente : même `label|bankId|amount` (clé utilisée
  // par le moteur de génération côté serveur). Cas non couverts : op réconciliée
  // à l'import dont le label a été suffixé `(rowLabel)` ou montant ajusté.
  const recurringKeys = useMemo(() => {
    const set = new Set();
    for (const r of recurring) {
      const bId = String(r.bankId?._id ?? r.bankId);
      set.add(`${r.label}|${bId}|${r.amount}`);
    }
    return set;
  }, [recurring]);
  const isFromRecurring = (op) => {
    const bId = String(op.bankId?._id ?? op.bankId);
    return recurringKeys.has(`${op.label}|${bId}|${op.amount}`);
  };

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
      <div className="md:hidden flex flex-col gap-2">
        {rows.map((op) => (
          <SwipeableCard
            key={op._id}
            op={op}
            onPoint={onPoint}
            onEdit={onEdit}
            onDelete={(id) => setDeleteTarget(id)}
            onMakeRecurring={onMakeRecurring}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">{dayjs(op.date).format('DD/MM')}</span>
              <div className="min-w-0 flex-1">
                {onCategoryChange && (op.categoryId ? (
                  <CategoryBadge
                    categoryId={op.categoryId}
                    categories={categories}
                    onRemove={() => onCategoryChange(op._id, null)}
                  />
                ) : (
                  <Select
                    value="none"
                    onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                  >
                    <SelectTrigger className="h-6 w-full max-w-32 border-dashed text-xs text-muted-foreground">
                      <SelectValue placeholder="Catégorie…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Sans catégorie</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? DEFAULT_COLOR }} />
                            {c.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
              </div>
              <span className={cn('text-sm font-semibold shrink-0', op.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              {isFromRecurring(op) && (
                <span title="Opération récurrente" className="shrink-0">
                  <Repeat className="h-3 w-3 text-violet-500" />
                </span>
              )}
              <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">{op.label}</span>
              <Switch checked={op.pointed} onCheckedChange={() => onPoint(op._id)} />
            </div>
          </SwipeableCard>
        ))}
      </div>

      <div className="hidden md:block">
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
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    {isFromRecurring(op) && (
                      <span title="Opération récurrente" className="shrink-0">
                        <Repeat className="h-3.5 w-3.5 text-violet-500" />
                      </span>
                    )}
                    {op.label}
                  </span>
                  {onCategoryChange && (op.categoryId ? (
                    <CategoryBadge
                      categoryId={op.categoryId}
                      categories={categories}
                      onRemove={() => onCategoryChange(op._id, null)}
                    />
                  ) : (
                    <Select
                      value="none"
                      onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-6 w-36 border-dashed text-xs text-muted-foreground">
                        <SelectValue placeholder="Catégorie…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sans catégorie</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            <span className="inline-flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? DEFAULT_COLOR }} />
                              {c.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
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
                  {onMakeRecurring && (
                    <Button variant="ghost" size="icon" aria-label="convertir en récurrente"
                      className="text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50"
                      onClick={(e) => { e.stopPropagation(); onMakeRecurring(op); }}
                      title="Convertir en récurrente">
                      <Repeat2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="éditer" onClick={(e) => { e.stopPropagation(); onEdit(op); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="supprimer" onClick={(e) => { e.stopPropagation(); setDeleteTarget(op._id); }}
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

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

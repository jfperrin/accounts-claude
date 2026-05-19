import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Pencil, Trash2, Repeat, Repeat2, ArrowLeftRight, Link2, Unlink2, Check,
  Clock,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatEur, amountClass } from '@/lib/utils';
import CategoryBadge from '@/components/CategoryBadge';
import CategorySelectItems from '@/components/CategorySelectItems';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import { buildTimelineItems } from '@/lib/timeline';

const POINT_REVEAL = 88;
const ACTION_WIDTH = 80;
const DRAG_THRESHOLD = 6;

function SwipeableCard({ op, onPoint, onEdit, onDelete, onMakeRecurring, children }) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const draggingRef = useRef(false);
  const axis = useRef(null);

  const showRecurring = !!onMakeRecurring && !op.transferId;
  const actionsCount = 2 + (showRecurring ? 1 : 0);
  const actionsReveal = ACTION_WIDTH * actionsCount;

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
    next = Math.max(-actionsReveal, Math.min(POINT_REVEAL, next));
    setOffset(next);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (offset > POINT_REVEAL / 2) setOffset(POINT_REVEAL);
    else if (offset < -actionsReveal / 2) setOffset(-actionsReveal);
    else setOffset(0);
    setTimeout(() => { moved.current = false; }, 0);
  };

  const handleClick = (e) => {
    if (moved.current) { e.stopPropagation(); return; }
    if (offset !== 0) { setOffset(0); e.stopPropagation(); }
  };

  const handleKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Escape' && offset !== 0) {
      e.preventDefault();
      setOffset(0);
    }
  };

  const close = () => setOffset(0);

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 left-0 flex">
        <button
          type="button"
          onClick={() => { close(); onPoint(op._id); }}
          className="flex flex-col items-center justify-center gap-0.5 bg-emerald-600 px-3 text-white text-[10px] font-medium"
          style={{ width: POINT_REVEAL }}
        >
          <Check className="h-4 w-4" />
          {op.pointed ? 'Dépointer' : 'Pointer'}
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => { close(); onEdit(op); }}
          className="flex flex-col items-center justify-center gap-0.5 bg-primary px-3 text-primary-foreground text-[10px] font-medium"
          style={{ width: ACTION_WIDTH }}
        >
          <Pencil className="h-4 w-4" />
          Éditer
        </button>
        {showRecurring && (
          <button
            type="button"
            onClick={() => { close(); onMakeRecurring(op); }}
            className="flex flex-col items-center justify-center gap-0.5 bg-slate-600 px-3 text-white text-[10px] font-medium"
            style={{ width: ACTION_WIDTH }}
          >
            <Repeat2 className="h-4 w-4" />
            Récurrente
          </button>
        )}
        <button
          type="button"
          onClick={() => { close(); onDelete(op._id); }}
          className="flex flex-col items-center justify-center gap-0.5 bg-rose-600 px-3 text-white text-[10px] font-medium"
          style={{ width: ACTION_WIDTH }}
        >
          <Trash2 className="h-4 w-4" />
          Supprimer
        </button>
      </div>
      <div
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
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
          'relative border border-border px-2 py-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          op.pointed ? 'bg-muted text-muted-foreground' : 'bg-card',
        )}
      >
        {children}
      </div>
    </div>
  );
}

function PreviewCardMobile({ op, categories }) {
  return (
    <div className="relative rounded-lg border border-dashed border-border/70 bg-muted/30 px-2 py-2 text-muted-foreground">
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-xs shrink-0">{dayjs(op.date).format('DD/MM')}</span>
        <div className="min-w-0 flex-1">
          <CategoryBadge categoryId={op.categoryId} categories={categories} />
        </div>
        <span className={cn('text-sm font-semibold shrink-0', amountClass(op.amount))}>
          {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-xs truncate min-w-0 flex-1">{op.label}</span>
        <span className="text-[10px] uppercase tracking-wide font-semibold text-primary/80 shrink-0">
          Récurrente prévue
        </span>
      </div>
    </div>
  );
}

export default function OperationsTimeline({
  operations = [],
  recurringPreviews = [],
  categories = [],
  recurring = [],
  onPoint, onEdit, onDelete, onCategoryChange, onMakeRecurring, onLinkTransfer, onUnlinkTransfer,
  selectedIds, onToggleSelect, onToggleSelectAll,
  showFuture = true,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const headerCheckboxRef = useRef(null);
  const selectable = !!(selectedIds && onToggleSelect && onToggleSelectAll);

  // Merge ops + previews. Previews ne participent pas à la sélection ni au comptage.
  const mergedOps = useMemo(() => {
    if (!showFuture || recurringPreviews.length === 0) return operations;
    return [...operations, ...recurringPreviews];
  }, [operations, recurringPreviews, showFuture]);

  const items = useMemo(() => buildTimelineItems({ ops: mergedOps }), [mergedOps]);

  const selectionStats = useMemo(() => {
    if (!selectable) return { selected: 0, all: false, total: 0 };
    const selectableOps = operations.filter((o) => !o.isPreview);
    let selected = 0;
    for (const o of selectableOps) if (selectedIds.has(o._id)) selected++;
    return {
      selected,
      total: selectableOps.length,
      all: selected > 0 && selected === selectableOps.length,
    };
  }, [selectable, selectedIds, operations]);

  useEffect(() => {
    if (!selectable || !headerCheckboxRef.current) return;
    const { selected, total } = selectionStats;
    headerCheckboxRef.current.indeterminate = selected > 0 && selected < total;
  }, [selectable, selectionStats]);

  // Match heuristique op ↔ récurrente : même `label|bankId|amount`.
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

  const confirmDelete = () => {
    onDelete(deleteTarget);
    setDeleteTarget(null);
  };

  const colSpan = selectable ? 7 : 6;
  const visibleOpCount = operations.length;

  return (
    <>
      {/* ── Mobile : cartes ── */}
      <div className="md:hidden flex flex-col gap-2">
        {items.map((it, idx) => {
          if (it.type === 'section') {
            return (
              <div
                key={`s-${idx}`}
                className="mt-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary"
              >
                <span className="h-px flex-1 bg-primary/30" />
                {it.label}
                <span className="h-px flex-1 bg-primary/30" />
              </div>
            );
          }
          if (it.type === 'day') {
            return (
              <div
                key={`d-${idx}`}
                className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {it.label}
              </div>
            );
          }
          const op = it.op;
          if (op.isPreview) {
            return <PreviewCardMobile key={op._id} op={op} categories={categories} />;
          }
          return (
            <SwipeableCard
              key={op._id}
              op={op}
              onPoint={onPoint}
              onEdit={onEdit}
              onDelete={(id) => setDeleteTarget(id)}
              onMakeRecurring={onMakeRecurring}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  {onCategoryChange && (
                    <Select
                      value={op.categoryId ? String(op.categoryId?._id ?? op.categoryId) : 'none'}
                      onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className={op.categoryId
                        ? 'h-auto w-fit border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden'
                        : 'h-6 w-full max-w-32 border-dashed text-xs text-muted-foreground'}>
                        {op.categoryId ? (
                          <CategoryBadge categoryId={op.categoryId} categories={categories} source={op.categorySource} />
                        ) : (
                          <SelectValue placeholder="Catégorie…" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sans catégorie</SelectItem>
                        <CategorySelectItems categories={categories} />
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <span className={cn('text-sm font-semibold shrink-0', amountClass(op.amount))}>
                  {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                {isFromRecurring(op) && (
                  <span title="Opération récurrente" className="shrink-0">
                    <Repeat className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                  </span>
                )}
                <span className="text-xs text-muted-foreground truncate min-w-0 flex-1">{op.label}</span>
              </div>
            </SwipeableCard>
          );
        })}
      </div>

      {/* ── Desktop : table avec lignes section/day inline ── */}
      <div className="hidden md:block rounded-md border border-border">
      <Table wrapperClassName="relative w-full">
        <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
          <TableRow>
            {selectable && (
              <TableHead className="w-8 text-center">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={selectionStats.all}
                  onChange={onToggleSelectAll}
                  aria-label="Sélectionner toutes les opérations visibles"
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </TableHead>
            )}
            <TableHead>Date</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead>Banque</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="text-center">Pointé</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it, idx) => {
            if (it.type === 'section') {
              return (
                <TableRow key={`s-${idx}`} className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="bg-primary/5 py-2">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      <span className="h-px flex-1 bg-primary/30" />
                      {it.label}
                      <span className="h-px flex-1 bg-primary/30" />
                    </div>
                  </TableCell>
                </TableRow>
              );
            }
            if (it.type === 'day') {
              return (
                <TableRow key={`d-${idx}`} className="hover:bg-transparent">
                  <TableCell colSpan={colSpan} className="bg-muted/30 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {it.label}
                  </TableCell>
                </TableRow>
              );
            }
            const op = it.op;
            if (op.isPreview) {
              return (
                <TableRow key={op._id} className="opacity-70 hover:bg-transparent">
                  {selectable && <TableCell className="w-8" />}
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary/70" />
                      {dayjs(op.date).format('DD/MM/YYYY')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-muted-foreground italic">
                        {op.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-primary/80">
                        Récurrente prévue
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {op.bankLabel && <Badge variant="secondary">{op.bankLabel}</Badge>}
                  </TableCell>
                  <TableCell className={cn('text-right font-semibold', amountClass(op.amount))}>
                    {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">—</TableCell>
                  <TableCell />
                </TableRow>
              );
            }
            const isSelected = selectable && selectedIds.has(op._id);
            return (
              <TableRow
                key={op._id}
                data-state={isSelected ? 'selected' : undefined}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.metaKey || e.ctrlKey || e.altKey) return;
                  const tag = e.target.tagName;
                  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
                  if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    onPoint(op._id);
                  } else if (e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                    onEdit(op);
                  } else if (e.key === 'Delete' || e.key === 'Backspace') {
                    e.preventDefault();
                    setDeleteTarget(op._id);
                  } else if (selectable && (e.key === 'x' || e.key === 'X' || e.key === ' ')) {
                    e.preventDefault();
                    onToggleSelect(op._id);
                  }
                }}
                className={cn(
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  op.pointed && 'opacity-50',
                  isSelected && 'bg-muted/40',
                )}
              >
                {selectable && (
                  <TableCell className="w-8 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(op._id)}
                      aria-label={`Sélectionner ${op.label}`}
                      className="h-4 w-4 cursor-pointer accent-primary"
                    />
                  </TableCell>
                )}
                <TableCell className="text-muted-foreground">{dayjs(op.date).format('DD/MM/YYYY')}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {op.transferId && (
                        <span title="Virement entre banques" className="shrink-0">
                          <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                        </span>
                      )}
                      {isFromRecurring(op) && (
                        <span title="Opération récurrente" className="shrink-0">
                          <Repeat className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        </span>
                      )}
                      {op.label}
                    </span>
                    {onCategoryChange && (
                      <Select
                        value={op.categoryId ? String(op.categoryId?._id ?? op.categoryId) : 'none'}
                        onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                      >
                        <SelectTrigger className={op.categoryId
                          ? 'h-auto w-fit border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden'
                          : 'h-6 w-36 border-dashed text-xs text-muted-foreground'}>
                          {op.categoryId ? (
                            <CategoryBadge categoryId={op.categoryId} categories={categories} source={op.categorySource} />
                          ) : (
                            <SelectValue placeholder="Catégorie…" />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Sans catégorie</SelectItem>
                          <CategorySelectItems categories={categories} />
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{op.bankId?.label}</Badge>
                </TableCell>
                <TableCell className={cn('text-right font-semibold', amountClass(op.amount))}>
                  {op.amount > 0 ? '+' : ''}{formatEur(op.amount)}
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={op.pointed} onCheckedChange={() => onPoint(op._id)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {onMakeRecurring && !op.transferId && (
                      <Button variant="ghost" size="icon" aria-label="convertir en récurrente"
                        className="text-primary hover:bg-primary/10"
                        onClick={(e) => { e.stopPropagation(); onMakeRecurring(op); }}
                        title="Convertir en récurrente">
                        <Repeat2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onLinkTransfer && !op.transferId && (
                      <Button variant="ghost" size="icon" aria-label="lier comme virement interbanque"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); onLinkTransfer(op); }}
                        title="Lier comme virement interbanque">
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onUnlinkTransfer && op.transferId && (
                      <Button variant="ghost" size="icon" aria-label="délier le virement"
                        className="text-muted-foreground hover:text-debit"
                        onClick={(e) => { e.stopPropagation(); onUnlinkTransfer(op); }}
                        title="Délier le virement">
                        <Unlink2 className="h-3.5 w-3.5" />
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
            );
          })}
        </TableBody>
      </Table>
      </div>

      {visibleOpCount > 0 && (
        <div className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
          {visibleOpCount} opération{visibleOpCount > 1 ? 's' : ''}
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

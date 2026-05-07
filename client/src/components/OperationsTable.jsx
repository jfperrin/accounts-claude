import { useState, useMemo, useEffect, useRef } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Repeat, Repeat2, Search, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react';
import dayjs from 'dayjs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatEur } from '@/lib/utils';
import CategoryBadge from '@/components/CategoryBadge';
import CategorySelectItems from '@/components/CategorySelectItems';
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

export default function OperationsTable({ operations, categories = [], banks = [], recurring = [], onPoint, onEdit, onDelete, onCategoryChange, onMakeRecurring, onFilterStateChange }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'label' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return operations.filter((op) => {
      if (q && !op.label?.toLowerCase().includes(q)) return false;
      if (bankFilter !== 'all') {
        const opBank = String(op.bankId?._id ?? op.bankId);
        if (opBank !== bankFilter) return false;
      }
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'none') return !op.categoryId;
      return op.categoryId === categoryFilter;
    });
  }, [operations, query, categoryFilter, bankFilter]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * dir;
      if (sortKey === 'label') return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }) * dir;
      const d = (new Date(a.date) - new Date(b.date)) * dir;
      if (d !== 0) return d;
      // À date égale : non pointées avant pointées (indépendant du sens de tri).
      return (a.pointed === b.pointed) ? 0 : (a.pointed ? 1 : -1);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [query, categoryFilter, bankFilter]);

  // Remonte au parent l'état des filtres (count + somme signée) pour qu'il
  // puisse compléter le titre de la table quand un filtre est actif.
  const filteredSum = useMemo(
    () => filtered.reduce((s, o) => s + o.amount, 0),
    [filtered],
  );
  useEffect(() => {
    if (!onFilterStateChange) return;
    const active = query.trim() !== '' || categoryFilter !== 'all' || bankFilter !== 'all';
    onFilterStateChange({ active, count: filtered.length, sum: filteredSum });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSum, filtered.length, query, categoryFilter, bankFilter]);

  const sortIcon = (k) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

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
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un libellé…"
            className="pl-8 pr-8 h-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Effacer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-9 w-40 sm:w-48" aria-label="Filtrer par catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              <SelectItem value="none">— Sans catégorie</SelectItem>
              <CategorySelectItems categories={categories} />
            </SelectContent>
          </Select>
        )}
        {banks.length > 1 && (
          <Select value={bankFilter} onValueChange={setBankFilter}>
            <SelectTrigger className="h-9 w-32 sm:w-40" aria-label="Filtrer par banque">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes banques</SelectItem>
              {banks.map((b) => (
                <SelectItem key={b._id} value={String(b._id)}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="md:hidden flex items-center gap-1">
          <Select value={sortKey} onValueChange={(v) => { setSortKey(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="label">Libellé</SelectItem>
              <SelectItem value="amount">Montant</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label={sortDir === 'asc' ? 'Croissant' : 'Décroissant'}
            onClick={() => { setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setPage(1); }}
          >
            {sortDir === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

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
                {onCategoryChange && (
                  <Select
                    value={op.categoryId ? String(op.categoryId?._id ?? op.categoryId) : 'none'}
                    onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                  >
                    <SelectTrigger className={op.categoryId
                      ? 'h-auto w-fit border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden'
                      : 'h-6 w-full max-w-32 border-dashed text-xs text-muted-foreground'}>
                      {op.categoryId ? (
                        <CategoryBadge categoryId={op.categoryId} categories={categories} />
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
              <span className={cn('text-sm font-semibold shrink-0', op.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
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
            <TableHead>
              <button type="button" onClick={() => toggleSort('date')} className="inline-flex items-center gap-1 hover:text-foreground">
                Date {sortIcon('date')}
              </button>
            </TableHead>
            <TableHead>
              <button type="button" onClick={() => toggleSort('label')} className="inline-flex items-center gap-1 hover:text-foreground">
                Libellé {sortIcon('label')}
              </button>
            </TableHead>
            <TableHead>Banque</TableHead>
            <TableHead className="text-right">
              <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-foreground ml-auto">
                Montant {sortIcon('amount')}
              </button>
            </TableHead>
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
                  {onCategoryChange && (
                    <Select
                      value={op.categoryId ? String(op.categoryId?._id ?? op.categoryId) : 'none'}
                      onValueChange={(v) => onCategoryChange(op._id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className={op.categoryId
                        ? 'h-auto w-fit border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden'
                        : 'h-6 w-36 border-dashed text-xs text-muted-foreground'}>
                        {op.categoryId ? (
                          <CategoryBadge categoryId={op.categoryId} categories={categories} />
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
              <TableCell className={cn('text-right font-semibold', op.amount < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
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

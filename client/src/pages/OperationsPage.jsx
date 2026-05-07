import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Tag, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import {
  create as createOp,
  update as updateOp,
  remove as removeOp,
  point,
  generateRecurring,
  importFile,
  resolveImport,
  getSimilarUncategorized,
  getSimilarExcludingCategory,
  findSimilarUncategorized,
  bulkCategorize,
} from '@/api/operations';
import { update as updateBank } from '@/api/banks';
import { create as createRecurring } from '@/api/recurringOperations';
import { useCategories } from '@/hooks/useCategories';
import { useBanks } from '@/hooks/useBanks';
import { useOperations } from '@/hooks/useOperations';
import { useRecurringOperations } from '@/hooks/useRecurringOperations';
import BankBalances from '@/components/BankBalances';
import OperationsTable from '@/components/OperationsTable';
import OperationForm from '@/components/OperationForm';
import ImportDialog from '@/components/ImportDialog';
import MakeRecurringDialog from '@/components/MakeRecurringDialog';
import ImportResolveDialog from '@/components/ImportResolveDialog';
import GenerateRecurringDialog from '@/components/GenerateRecurringDialog';
import BulkCategorizeDialog from '@/components/BulkCategorizeDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { formatEur } from '@/lib/utils';

const COOKIE_NAME = 'dash_date_range';
const RANGE_MODES = [
  { value: '30d', label: '30j' },
  { value: '90d', label: '90j' },
  { value: 'month', label: 'Mois' },
  { value: 'custom', label: 'Perso' },
];

function getCookiePref() {
  const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
  if (!match) return null;
  try { return JSON.parse(decodeURIComponent(match[1])); } catch { return null; }
}

function setCookiePref(val) {
  const encoded = encodeURIComponent(JSON.stringify(val));
  document.cookie = `${COOKIE_NAME}=${encoded}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export default function OperationsPage() {
  const { categories } = useCategories();
  const { banks, reload: reloadBanks } = useBanks();
  const { recurring } = useRecurringOperations();

  const [rangeMode, setRangeModeRaw] = useState(() => getCookiePref()?.mode ?? 'month');
  const [customStart, setCustomStart] = useState(() => getCookiePref()?.start ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(() => getCookiePref()?.end ?? dayjs().format('YYYY-MM-DD'));
  const [monthOffset, setMonthOffsetRaw] = useState(() => getCookiePref()?.monthOffset ?? 0);

  const persist = (next) => setCookiePref({ mode: rangeMode, start: customStart, end: customEnd, monthOffset, ...next });
  const setRangeMode = (mode) => { setRangeModeRaw(mode); persist({ mode }); };
  const updateCustomStart = (v) => { setCustomStart(v); persist({ start: v }); };
  const updateCustomEnd = (v) => { setCustomEnd(v); persist({ end: v }); };
  const setMonthOffset = (v) => { setMonthOffsetRaw(v); persist({ monthOffset: v }); };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return { startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    if (rangeMode === '90d') return { startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    if (rangeMode === 'month') {
      const m = dayjs().add(monthOffset, 'month');
      return { startDate: m.startOf('month').format('YYYY-MM-DD'), endDate: m.endOf('month').format('YYYY-MM-DD') };
    }
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd, monthOffset]);

  const { operations, reload: reloadOperations } = useOperations({ startDate, endDate });

  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const uncategorizedCount = useMemo(
    () => operations.filter((o) => !o.categoryId).length,
    [operations],
  );
  const visibleOperations = useMemo(
    () => (onlyUncategorized ? operations.filter((o) => !o.categoryId) : operations),
    [operations, onlyUncategorized],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);

  const newOpBtnRef = useRef(null);
  const bankBalancesRef = useRef(null);
  const [fabVisible, setFabVisible] = useState(false);
  const [totalBadgeVisible, setTotalBadgeVisible] = useState(false);
  const [tableFilter, setTableFilter] = useState({ active: false, count: 0, sum: 0 });
  const handleTableFilterChange = useCallback((info) => setTableFilter(info), []);

  useEffect(() => {
    const el = newOpBtnRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setFabVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = bankBalancesRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setTotalBadgeVisible(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [banks.length]);

  const handleSaveBalance = async (bankId, value) => {
    await updateBank(bankId, { currentBalance: value });
    reloadBanks();
  };

  const [generateRecurringOpen, setGenerateRecurringOpen] = useState(false);

  const handleGenerateRecurring = () => setGenerateRecurringOpen(true);

  const handleConfirmGenerateRecurring = async ({ month, year }) => {
    try {
      const { imported } = await generateRecurring({ month, year });
      toast.success(`${imported} opération(s) générée(s)`);
      setGenerateRecurringOpen(false);
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la génération');
    }
  };

  const handleFormFinish = async (values) => {
    try {
      if (editOp) await updateOp(editOp._id, values);
      else await createOp(values);
      setFormOpen(false);
      setEditOp(null);
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handlePoint = async (id) => {
    await point(id);
    reloadOperations();
    reloadBanks();
  };

  const handleDelete = async (id) => {
    await removeOp(id);
    reloadOperations();
    reloadBanks();
  };

  // Quand on affecte une catégorie : si on en pose une (truthy), on cherche
  // les opérations similaires sans catégorie pour proposer un bulk-update.
  const [bulkCat, setBulkCat] = useState(null); // { categoryId, candidates }

  const handleCategoryChange = async (id, categoryId) => {
    // On capture l'ancienne catégorie AVANT la mise à jour pour décider du
    // type de recherche : si la source était déjà catégorisée et qu'on
    // change vers une autre catégorie, on élargit aux ops similaires non
    // déjà dans la nouvelle catégorie (= uncat + autres catégories). Sinon
    // on garde le scope historique (uncat seulement).
    const sourceOp = operations.find((o) => o._id === id);
    const prevCategoryId = sourceOp?.categoryId
      ? String(sourceOp.categoryId?._id ?? sourceOp.categoryId)
      : null;
    await updateOp(id, { categoryId });
    reloadOperations();
    if (!categoryId) return;
    try {
      const candidates = (prevCategoryId && prevCategoryId !== categoryId)
        ? await getSimilarExcludingCategory(id, categoryId)
        : await getSimilarUncategorized(id);
      if (candidates.length > 0) setBulkCat({ categoryId, candidates });
    } catch {
      /* silencieux : la catégorie principale est déjà appliquée */
    }
  };

  const handleBulkConfirm = async (ids) => {
    if (ids.length === 0) { setBulkCat(null); return; }
    try {
      const { updated } = await bulkCategorize(ids, bulkCat.categoryId);
      toast.success(`${updated} opération${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
      reloadOperations();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setBulkCat(null);
    }
  };

  const handleImportSubmit = async (file, bankId) => {
    try {
      const result = await importFile(file, { bankId });
      const parts = [];
      if (result.imported) parts.push(`${result.imported} ajoutée(s)`);
      if (result.autoReconciled) parts.push(`${result.autoReconciled} pointée(s) auto`);
      if (result.duplicates) parts.push(`${result.duplicates} doublon(s)`);
      if (result.invalid) parts.push(`${result.invalid} invalide(s)`);
      toast.success(parts.join(' · ') || 'Aucune opération à importer');
      setImportOpen(false);
      reloadOperations();
      reloadBanks();
      if (Array.isArray(result.pendingMatches) && result.pendingMatches.length > 0) {
        setPendingMatches(result.pendingMatches);
      }
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'import", { duration: 10000 });
    }
  };

  const handleResolveMatches = async (resolutions) => {
    try {
      const result = await resolveImport(resolutions);
      const parts = [];
      if (result.reconciled) parts.push(`${result.reconciled} pointée(s)`);
      if (result.imported) parts.push(`${result.imported} ajoutée(s)`);
      toast.success(parts.join(' · ') || 'Aucun changement');
      setPendingMatches(null);
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la résolution', { duration: 10000 });
    }
  };

  const openMakeRecurring = (op) => {
    setRecurringForm({
      label: op.label,
      amount: String(op.amount),
      dayOfMonth: String(dayjs(op.date).date()),
      bankId: op.bankId?._id ?? String(op.bankId ?? ''),
      categoryId: op.categoryId ?? 'none',
    });
  };

  const handleRecurringSave = async (e) => {
    e.preventDefault();
    const categoryId = recurringForm.categoryId !== 'none' ? recurringForm.categoryId : null;
    const { label, bankId } = recurringForm;
    try {
      await createRecurring({
        label,
        amount: parseFloat(recurringForm.amount),
        dayOfMonth: Number(recurringForm.dayOfMonth),
        bankId,
        categoryId,
      });
      toast.success('Opération récurrente créée');
      setRecurringForm(null);
      if (categoryId && bankId) {
        try {
          const candidates = await findSimilarUncategorized({ label, bankId });
          if (candidates.length > 0) setBulkCat({ categoryId, candidates });
        } catch {
          /* silencieux : la récurrente est déjà enregistrée */
        }
      }
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création');
    }
  };

  const totalProjected = useMemo(
    () => banks.reduce((s, b) => s + (b.projectedBalance ?? 0), 0),
    [banks],
  );

  return (
    <div className="space-y-4">
      {banks.length > 1 && totalBadgeVisible && (
        <div className="animate-fly-to-corner fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2 shadow-lg shadow-indigo-500/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">Total</p>
          <span className="text-sm font-extrabold text-white">{formatEur(totalProjected)}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-indigo-600 shrink-0" />
        <div className="flex rounded-lg border border-border overflow-hidden">
          {RANGE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setRangeMode(m.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeMode === m.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {rangeMode === 'custom' && (
          <>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={(e) => updateCustomStart(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-sm text-muted-foreground">→</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => updateCustomEnd(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </>
        )}
        {rangeMode === 'month' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset(monthOffset - 1)}
              aria-label="Mois précédent"
              className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium tabular-nums capitalize">
              {dayjs().add(monthOffset, 'month').format('MMMM YYYY')}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset(monthOffset + 1)}
              aria-label="Mois suivant"
              className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {monthOffset !== 0 && (
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                className="ml-1 text-xs text-indigo-600 hover:underline"
              >
                Auj.
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOnlyUncategorized((s) => !s)}
          aria-pressed={onlyUncategorized}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            onlyUncategorized
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
          title="Afficher uniquement les opérations sans catégorie"
        >
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">Sans catégorie</span>
          {uncategorizedCount > 0 && (
            <span className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
              onlyUncategorized ? 'bg-white/20 text-white' : 'bg-muted text-foreground'
            }`}>
              {uncategorizedCount}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="sm:hidden" aria-label="Importer">
              <Upload className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleGenerateRecurring}>
              <Download className="h-4 w-4" />
              Opérations récurrentes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Un fichier d'opérations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden sm:inline-flex gap-2">
              <Upload className="h-4 w-4" />
              Importer
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleGenerateRecurring}>
              <Download className="h-4 w-4" />
              Opérations récurrentes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Un fichier d'opérations
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button ref={newOpBtnRef} onClick={() => { setEditOp(null); setFormOpen(true); }} className="hidden md:inline-flex gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle opération
        </Button>
      </div>

      {banks.length > 0 && (
        <>
          <div ref={bankBalancesRef}>
            <BankBalances banks={banks} onSaveBalance={handleSaveBalance} />
          </div>
          <Separator />
        </>
      )}

      {visibleOperations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">
            {onlyUncategorized
              ? 'Aucune opération sans catégorie sur cette période'
              : 'Aucune opération sur cette période'}
          </p>
        </div>
      ) : (
        <div className="sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-4 sm:shadow-xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-semibold text-foreground flex flex-wrap items-baseline gap-x-2">
              {rangeMode === '30d' && '30 derniers jours'}
              {rangeMode === '90d' && '90 derniers jours'}
              {rangeMode === 'month' && (
                <span className="capitalize">{dayjs().add(monthOffset, 'month').format('MMMM YYYY')}</span>
              )}
              {rangeMode === 'custom' && `${dayjs(startDate).format('DD/MM/YYYY')} – ${dayjs(endDate).format('DD/MM/YYYY')}`}
              {tableFilter.active && (
                <Badge
                  variant="outline"
                  className={`tabular-nums ${tableFilter.sum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {formatEur(tableFilter.sum)}
                </Badge>
              )}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums shrink-0">
              {tableFilter.active
                ? `${tableFilter.count} sur ${visibleOperations.length}`
                : `${visibleOperations.length} opération(s)`}
              {!tableFilter.active && onlyUncategorized && operations.length !== visibleOperations.length && (
                <span> / {operations.length}</span>
              )}
            </span>
          </div>
          <OperationsTable
            operations={visibleOperations}
            categories={categories}
            banks={banks}
            recurring={recurring}
            onPoint={handlePoint}
            onEdit={(op) => { setEditOp(op); setFormOpen(true); }}
            onDelete={handleDelete}
            onCategoryChange={handleCategoryChange}
            onMakeRecurring={openMakeRecurring}
            onFilterStateChange={handleTableFilterChange}
          />
        </div>
      )}

      <OperationForm
        open={formOpen}
        operation={editOp}
        banks={banks}
        categories={categories}
        onFinish={handleFormFinish}
        onCancel={() => { setFormOpen(false); setEditOp(null); }}
      />

      <ImportDialog
        open={importOpen}
        banks={banks}
        onSubmit={handleImportSubmit}
        onCancel={() => setImportOpen(false)}
      />

      <MakeRecurringDialog
        open={!!recurringForm}
        form={recurringForm}
        banks={banks}
        categories={categories}
        onChange={(key, value) => setRecurringForm((f) => ({ ...f, [key]: value }))}
        onSubmit={handleRecurringSave}
        onCancel={() => setRecurringForm(null)}
      />

      <ImportResolveDialog
        open={!!pendingMatches}
        pendingMatches={pendingMatches || []}
        onResolve={handleResolveMatches}
        onCancel={() => setPendingMatches(null)}
      />

      <GenerateRecurringDialog
        open={generateRecurringOpen}
        onConfirm={handleConfirmGenerateRecurring}
        onCancel={() => setGenerateRecurringOpen(false)}
      />

      <BulkCategorizeDialog
        open={!!bulkCat}
        candidates={bulkCat?.candidates ?? []}
        categoryId={bulkCat?.categoryId}
        categories={categories}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkCat(null)}
      />

      <button
        type="button"
        onClick={() => { setEditOp(null); setFormOpen(true); }}
        className={`animate-fly-to-corner fixed bottom-28 right-6 z-50 h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-500/40 transition-transform hover:bg-indigo-700 hover:scale-105 active:scale-95 md:bottom-8 md:right-8 flex ${fabVisible ? 'md:flex' : 'md:hidden'}`}
        aria-label="Nouvelle opération"
        title="Nouvelle opération"
      >
        <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}

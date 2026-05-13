import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Tag, Upload, Search, X, ArrowLeftRight } from 'lucide-react';
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
  bulkPoint,
  bulkDelete,
  transfer as transferOp,
  unlinkTransfer as unlinkTransferOp,
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
import TransferDialog from '@/components/TransferDialog';
import LinkTransferDialog from '@/components/LinkTransferDialog';
import TransferCandidatesCard from '@/components/TransferCandidatesCard';
import ImportResolveDialog from '@/components/ImportResolveDialog';
import GenerateRecurringDialog from '@/components/GenerateRecurringDialog';
import BulkCategorizeDialog from '@/components/BulkCategorizeDialog';
import BulkActionBar from '@/components/BulkActionBar';
import BulkSelectCategoryDialog from '@/components/BulkSelectCategoryDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import CategorySelectItems from '@/components/CategorySelectItems';
import EmptyState from '@/components/EmptyState';
import TableSkeleton from '@/components/TableSkeleton';
import { Building2, ListOrdered } from 'lucide-react';
import { formatEur, amountClass } from '@/lib/utils';

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
  // Wrapper compatible avec la forme fonctionnelle (Vercel `rerender-functional-setstate`).
  const setMonthOffset = (next) => {
    setMonthOffsetRaw((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      persist({ monthOffset: v });
      return v;
    });
  };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return { startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    if (rangeMode === '90d') return { startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    if (rangeMode === 'month') {
      const m = dayjs().add(monthOffset, 'month');
      return { startDate: m.startOf('month').format('YYYY-MM-DD'), endDate: m.endOf('month').format('YYYY-MM-DD') };
    }
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd, monthOffset]);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim()), 250);
    return () => clearTimeout(id);
  }, [searchInput]);
  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'none' | <id>
  const [filterPointed, setFilterPointed] = useState('all');   // 'all' | 'true' | 'false'
  const [filterBank, setFilterBank] = useState('all');         // 'all' | <id>
  const filtersActive = q || filterCategory !== 'all' || filterPointed !== 'all' || filterBank !== 'all';
  const clearFilters = () => {
    setSearchInput(''); setQ('');
    setFilterCategory('all'); setFilterPointed('all'); setFilterBank('all');
  };

  const { operations, reload: reloadOperations, loading: operationsLoading } = useOperations({
    startDate,
    endDate,
    q: q || undefined,
    categoryId: filterCategory === 'all' ? undefined : filterCategory,
    pointed: filterPointed === 'all' ? undefined : filterPointed === 'true',
    bankId: filterBank === 'all' ? undefined : filterBank,
  });

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

  // Entry point depuis la palette Cmd+K : `/operations?new=1` ouvre directement
  // le formulaire de création. On consomme le param dès qu'il est lu pour ne
  // pas rouvrir le modal à chaque navigation.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditOp(null);
      setFormOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [linkTransferOp, setLinkTransferOp] = useState(null);
  // Bumpé après import ou link/unlink pour forcer un re-scan des candidats.
  const [candidatesReloadKey, setCandidatesReloadKey] = useState(0);
  const bumpCandidates = () => setCandidatesReloadKey((k) => k + 1);
  const [pendingMatches, setPendingMatches] = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);

  // Sélection multi-ops pour les actions de masse (pointer / catégoriser /
  // supprimer). On stocke un Set d'ids. La sélection effective au moment d'agir
  // est l'intersection avec `visibleOperations` — une op filtrée n'est pas
  // "perdue" mais n'est pas comptée tant qu'elle est invisible.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const effectiveSelectedIds = useMemo(() => {
    const visible = new Set(visibleOperations.map((o) => o._id));
    return [...selectedIds].filter((id) => visible.has(id));
  }, [selectedIds, visibleOperations]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const allSelected = effectiveSelectedIds.length === visibleOperations.length && visibleOperations.length > 0;
      if (allSelected) {
        const next = new Set(prev);
        for (const o of visibleOperations) next.delete(o._id);
        return next;
      }
      const next = new Set(prev);
      for (const o of visibleOperations) next.add(o._id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkPoint = async (pointed) => {
    if (effectiveSelectedIds.length === 0) return;
    try {
      await bulkPoint(effectiveSelectedIds, pointed);
      toast.success(`${effectiveSelectedIds.length} opération${effectiveSelectedIds.length > 1 ? 's' : ''} ${pointed ? 'pointée' : 'dépointée'}${effectiveSelectedIds.length > 1 ? 's' : ''}`);
      clearSelection();
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Erreur lors du pointage');
    }
  };

  const handleBulkCategorize = async (categoryId) => {
    if (effectiveSelectedIds.length === 0) return;
    try {
      await bulkCategorize(effectiveSelectedIds, categoryId);
      toast.success(`${effectiveSelectedIds.length} opération${effectiveSelectedIds.length > 1 ? 's' : ''} catégorisée${effectiveSelectedIds.length > 1 ? 's' : ''}`);
      setBulkCategoryOpen(false);
      clearSelection();
      reloadOperations();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Erreur lors de la catégorisation');
    }
  };

  const handleBulkDelete = async () => {
    if (effectiveSelectedIds.length === 0) return;
    try {
      await bulkDelete(effectiveSelectedIds);
      toast.success(`${effectiveSelectedIds.length} opération${effectiveSelectedIds.length > 1 ? 's' : ''} supprimée${effectiveSelectedIds.length > 1 ? 's' : ''}`);
      setBulkDeleteOpen(false);
      clearSelection();
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Erreur lors de la suppression');
    }
  };

  const newOpBtnRef = useRef(null);
  const bankBalancesRef = useRef(null);
  const [fabVisible, setFabVisible] = useState(false);
  const [totalBadgeVisible, setTotalBadgeVisible] = useState(false);
  const visibleSum = useMemo(
    () => visibleOperations.reduce((s, o) => s + o.amount, 0),
    [visibleOperations],
  );

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

  const handleConfirmGenerateRecurring = async ({ month, year, recurringIds }) => {
    try {
      const { imported } = await generateRecurring({ month, year, recurringIds });
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

  const handleTransferFinish = async (values) => {
    try {
      await transferOp(values);
      toast.success('Virement enregistré');
      setTransferOpen(false);
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Erreur lors du virement");
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
    bumpCandidates();
  };

  const handleUnlinkTransfer = async (op) => {
    try {
      await unlinkTransferOp(op._id);
      toast.success('Virement délié');
      reloadOperations();
      bumpCandidates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors du déliage');
    }
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
      bumpCandidates();
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
      amount: String(Math.abs(op.amount)),
      kind: op.amount < 0 ? 'debit' : 'credit',
      dayOfMonth: String(dayjs(op.date).date()),
      bankId: op.bankId?._id ?? String(op.bankId ?? ''),
      categoryId: op.categoryId ?? 'none',
    });
  };

  const handleRecurringSave = async (e) => {
    e.preventDefault();
    const categoryId = recurringForm.categoryId !== 'none' ? recurringForm.categoryId : null;
    const { label, bankId } = recurringForm;
    const abs = Math.abs(parseFloat(recurringForm.amount));
    try {
      await createRecurring({
        label,
        amount: recurringForm.kind === 'debit' ? -abs : abs,
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
        <div className="animate-fly-to-corner fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 shadow-lg shadow-primary/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">Total</p>
          <span className="text-sm font-extrabold tabular-nums text-primary-foreground">{formatEur(totalProjected)}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-primary shrink-0" />
        <div className="flex rounded-lg border border-border overflow-hidden">
          {RANGE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setRangeMode(m.value)}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                rangeMode === m.value
                  ? 'bg-primary text-primary-foreground'
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
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground">→</span>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={(e) => updateCustomEnd(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </>
        )}
        {rangeMode === 'month' && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o - 1)}
              aria-label="Mois précédent"
              className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-35 text-center text-sm font-medium tabular-nums capitalize">
              {dayjs().add(monthOffset, 'month').format('MMMM YYYY')}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o + 1)}
              aria-label="Mois suivant"
              className="rounded-md border border-border bg-card p-1 text-muted-foreground hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {monthOffset !== 0 && (
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                className="ml-1 text-xs text-primary hover:underline"
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
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:bg-muted'
          }`}
          title="Afficher uniquement les opérations sans catégorie"
        >
          <Tag className="h-4 w-4" />
          <span className="hidden sm:inline">Sans catégorie</span>
          {uncategorizedCount > 0 && (
            <span className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
              onlyUncategorized ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button ref={newOpBtnRef} className="hidden md:inline-flex gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle opération
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditOp(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nouvelle opération
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTransferOpen(true)} disabled={banks.length < 2}>
              <ArrowLeftRight className="h-4 w-4" />
              Virement entre banques
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {banks.length > 0 && (
        <>
          <div ref={bankBalancesRef}>
            <BankBalances banks={banks} onSaveBalance={handleSaveBalance} />
          </div>
          <Separator />
        </>
      )}

      {banks.length >= 2 && (
        <TransferCandidatesCard
          reloadKey={candidatesReloadKey}
          onLinked={() => { reloadOperations(); reloadBanks(); }}
        />
      )}

      {banks.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher dans le libellé…"
              className="pl-9 pr-9"
              aria-label="Rechercher dans les opérations"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40" aria-label="Filtrer par catégorie"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="none">Sans catégorie</SelectItem>
                <CategorySelectItems categories={categories} />
              </SelectContent>
            </Select>
            <Select value={filterPointed} onValueChange={setFilterPointed}>
              <SelectTrigger className="w-35" aria-label="Filtrer par pointage"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous états</SelectItem>
                <SelectItem value="true">Pointées</SelectItem>
                <SelectItem value="false">Non pointées</SelectItem>
              </SelectContent>
            </Select>
            {banks.length > 1 && (
              <Select value={filterBank} onValueChange={setFilterBank}>
                <SelectTrigger className="w-40" aria-label="Filtrer par banque"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes banques</SelectItem>
                  {banks.map((b) => (
                    <SelectItem key={b._id} value={String(b._id)}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtersActive && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      )}

      {operationsLoading && visibleOperations.length === 0 ? (
        <TableSkeleton rows={6} cols={['w-24', 'w-48', 'w-20', 'w-24', 'w-8']} />
      ) : visibleOperations.length === 0 ? (
        filtersActive ? (
          <EmptyState
            variant="card"
            icon={Search}
            title="Aucun résultat pour ces filtres"
            actions={
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Réinitialiser les filtres
              </Button>
            }
          />
        ) : onlyUncategorized ? (
          <EmptyState
            variant="card"
            icon={Tag}
            title="Toutes les opérations de la période sont catégorisées."
          />
        ) : banks.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Pas encore de banque"
            description="Avant d'ajouter des opérations, crée d'abord une banque pour suivre ses soldes."
            actions={
              <Button asChild size="sm">
                <a href="/banks">Aller aux banques</a>
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={ListOrdered}
            title="Pas encore d'opération sur cette période"
            description="Importe un relevé bancaire pour rapatrier les opérations en masse, ou ajoute une opération à la main."
            actions={
              <>
                <Button onClick={() => setImportOpen(true)} variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                  Importer un fichier
                </Button>
                <Button onClick={() => { setEditOp(null); setFormOpen(true); }} size="sm">
                  <Plus className="h-4 w-4" />
                  Nouvelle opération
                </Button>
              </>
            }
          />
        )
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
              {filtersActive && (
                <Badge
                  variant="outline"
                  className={`tabular-nums ${amountClass(visibleSum)}`}
                >
                  {formatEur(visibleSum)}
                </Badge>
              )}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums shrink-0">
              {visibleOperations.length} opération(s)
              {onlyUncategorized && operations.length !== visibleOperations.length && (
                <span> / {operations.length}</span>
              )}
            </span>
          </div>
          <OperationsTable
            operations={visibleOperations}
            categories={categories}
            recurring={recurring}
            onPoint={handlePoint}
            onEdit={(op) => { setEditOp(op); setFormOpen(true); }}
            onDelete={handleDelete}
            onCategoryChange={handleCategoryChange}
            onMakeRecurring={openMakeRecurring}
            onLinkTransfer={(op) => setLinkTransferOp(op)}
            onUnlinkTransfer={handleUnlinkTransfer}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllVisible}
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
        recurring={recurring}
        onConfirm={handleConfirmGenerateRecurring}
        onCancel={() => setGenerateRecurringOpen(false)}
      />

      <TransferDialog
        open={transferOpen}
        banks={banks}
        onFinish={handleTransferFinish}
        onCancel={() => setTransferOpen(false)}
      />

      <LinkTransferDialog
        open={!!linkTransferOp}
        sourceOp={linkTransferOp}
        onClose={() => setLinkTransferOp(null)}
        onLinked={() => { reloadOperations(); bumpCandidates(); }}
      />

      <BulkCategorizeDialog
        open={!!bulkCat}
        candidates={bulkCat?.candidates ?? []}
        categoryId={bulkCat?.categoryId}
        categories={categories}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkCat(null)}
      />

      <BulkActionBar
        count={effectiveSelectedIds.length}
        onPoint={() => handleBulkPoint(true)}
        onUnpoint={() => handleBulkPoint(false)}
        onCategorize={() => setBulkCategoryOpen(true)}
        onDelete={() => setBulkDeleteOpen(true)}
        onCancel={clearSelection}
      />

      <BulkSelectCategoryDialog
        open={bulkCategoryOpen}
        count={effectiveSelectedIds.length}
        categories={categories}
        onConfirm={handleBulkCategorize}
        onCancel={() => setBulkCategoryOpen(false)}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Supprimer {effectiveSelectedIds.length} opération{effectiveSelectedIds.length > 1 ? 's' : ''}&nbsp;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les opérations seront définitivement supprimées. Les virements
              internes liés voient leurs deux jambes effacées en cascade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`animate-fly-to-corner fixed bottom-28 right-6 z-50 h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 transition-transform hover:bg-primary/90 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-8 md:right-8 flex ${fabVisible ? 'md:flex' : 'md:hidden'}`}
            aria-label="Créer (opération ou virement)"
            title="Créer"
          >
            <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={12}>
          <DropdownMenuItem onClick={() => { setEditOp(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Nouvelle opération
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTransferOpen(true)} disabled={banks.length < 2}>
            <ArrowLeftRight className="h-4 w-4" />
            Virement entre banques
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

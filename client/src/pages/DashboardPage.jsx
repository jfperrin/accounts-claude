import { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarDays, ChevronDown, Download, Plus, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as operationsApi from '@/api/operations';
import * as banksApi from '@/api/banks';
import * as recurringApi from '@/api/recurringOperations';
import { useCategories } from '@/hooks/useCategories';
import { useBanks } from '@/hooks/useBanks';
import { useOperations } from '@/hooks/useOperations';
import BankBalances from '@/components/BankBalances';
import OperationsTable from '@/components/OperationsTable';
import OperationForm from '@/components/OperationForm';
import ImportDialog from '@/components/ImportDialog';
import MakeRecurringDialog from '@/components/MakeRecurringDialog';
import ImportResolveDialog from '@/components/ImportResolveDialog';
import GenerateRecurringDialog from '@/components/GenerateRecurringDialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { formatEur } from '@/lib/utils';

const COOKIE_NAME = 'dash_date_range';
const RANGE_MODES = [
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: 'custom', label: 'Personnalisé' },
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

export default function DashboardPage() {
  const { categories } = useCategories();
  const { banks, reload: reloadBanks } = useBanks();

  const [rangeMode, setRangeModeRaw] = useState(() => getCookiePref()?.mode ?? '30d');
  const [customStart, setCustomStart] = useState(() => getCookiePref()?.start ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(() => getCookiePref()?.end ?? dayjs().format('YYYY-MM-DD'));

  const setRangeMode = (mode) => { setRangeModeRaw(mode); setCookiePref({ mode, start: customStart, end: customEnd }); };
  const updateCustomStart = (v) => { setCustomStart(v); setCookiePref({ mode: rangeMode, start: v, end: customEnd }); };
  const updateCustomEnd = (v) => { setCustomEnd(v); setCookiePref({ mode: rangeMode, start: customStart, end: v }); };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return { startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    if (rangeMode === '90d') return { startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'), endDate: '2099-12-31' };
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd]);

  const { operations, reload: reloadOperations } = useOperations({ startDate, endDate });

  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingMatches, setPendingMatches] = useState(null);
  const [recurringForm, setRecurringForm] = useState(null);

  const newOpBtnRef = useRef(null);
  const bankBalancesRef = useRef(null);
  const [fabVisible, setFabVisible] = useState(false);
  const [totalBadgeVisible, setTotalBadgeVisible] = useState(false);

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
    await banksApi.update(bankId, { currentBalance: value });
    reloadBanks();
  };

  const [generateRecurringOpen, setGenerateRecurringOpen] = useState(false);

  const handleGenerateRecurring = () => setGenerateRecurringOpen(true);

  const handleConfirmGenerateRecurring = async ({ month, year }) => {
    try {
      const { imported } = await operationsApi.generateRecurring({ month, year });
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
      if (editOp) await operationsApi.update(editOp._id, values);
      else await operationsApi.create(values);
      setFormOpen(false);
      setEditOp(null);
      reloadOperations();
      reloadBanks();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handlePoint = async (id) => {
    await operationsApi.point(id);
    reloadOperations();
    reloadBanks();
  };

  const handleDelete = async (id) => {
    await operationsApi.remove(id);
    reloadOperations();
    reloadBanks();
  };

  const handleCategoryChange = async (id, category) => {
    await operationsApi.update(id, { category });
    reloadOperations();
  };

  const handleImportSubmit = async (file, bankId) => {
    try {
      const result = await operationsApi.importFile(file, { bankId });
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
      const result = await operationsApi.resolveImport(resolutions);
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
      category: op.category ?? 'none',
    });
  };

  const handleRecurringSave = async (e) => {
    e.preventDefault();
    try {
      await recurringApi.create({
        label: recurringForm.label,
        amount: parseFloat(recurringForm.amount),
        dayOfMonth: Number(recurringForm.dayOfMonth),
        bankId: recurringForm.bankId,
        category: recurringForm.category !== 'none' ? recurringForm.category : null,
      });
      toast.success('Opération récurrente créée');
      setRecurringForm(null);
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-indigo-600" />
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
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
        <Button ref={newOpBtnRef} onClick={() => { setEditOp(null); setFormOpen(true); }} className="gap-2">
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

      {operations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Aucune opération sur cette période</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-foreground">
              {rangeMode === '30d' && '30 derniers jours'}
              {rangeMode === '90d' && '90 derniers jours'}
              {rangeMode === 'custom' && `${dayjs(startDate).format('DD/MM/YYYY')} – ${dayjs(endDate).format('DD/MM/YYYY')}`}
            </span>
            <span className="text-sm text-muted-foreground">{operations.length} opération(s)</span>
          </div>
          <OperationsTable
            operations={operations}
            categories={categories}
            onPoint={handlePoint}
            onEdit={(op) => { setEditOp(op); setFormOpen(true); }}
            onDelete={handleDelete}
            onCategoryChange={handleCategoryChange}
            onMakeRecurring={openMakeRecurring}
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

      {fabVisible && (
        <button
          type="button"
          onClick={() => { setEditOp(null); setFormOpen(true); }}
          className="animate-fly-to-corner fixed bottom-28 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 shadow-lg shadow-indigo-500/40 transition-transform hover:bg-indigo-700 hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
          aria-label="Nouvelle opération"
          title="Nouvelle opération"
        >
          <Plus className="h-6 w-6 text-white" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

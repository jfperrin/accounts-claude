import { useEffect, useState, useMemo, useRef } from 'react';
import { CalendarDays, ChevronDown, Download, Plus, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as operationsApi from '@/api/operations';
import * as banksApi from '@/api/banks';
import * as recurringApi from '@/api/recurringOperations';
import { useCategories } from '@/hooks/useCategories';
import BankBalances from '@/components/BankBalances';
import OperationsTable from '@/components/OperationsTable';
import OperationForm from '@/components/OperationForm';
import ImportResolveDialog from '@/components/ImportResolveDialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { formatEur } from '@/lib/utils';
import { DEFAULT_COLOR } from '@/lib/categoryColors';

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
  const [banks, setBanks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);

  // Sélecteur de plage de dates — persisté dans un cookie
  const [rangeMode, setRangeModeRaw] = useState(() => getCookiePref()?.mode ?? '30d');
  const [customStart, setCustomStart] = useState(() => getCookiePref()?.start ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(() => getCookiePref()?.end ?? dayjs().format('YYYY-MM-DD'));

  const setRangeMode = (mode) => {
    setRangeModeRaw(mode);
    setCookiePref({ mode, start: customStart, end: customEnd });
  };
  const updateCustomStart = (v) => {
    setCustomStart(v);
    setCookiePref({ mode: rangeMode, start: v, end: customEnd });
  };
  const updateCustomEnd = (v) => {
    setCustomEnd(v);
    setCookiePref({ mode: rangeMode, start: customStart, end: v });
  };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return { startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') };
    if (rangeMode === '90d') return { startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') };
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd]);

  // État de la modale d'import (QIF / OFX / ZIP)
  const [importOpen, setImportOpen] = useState(false);
  const [importBankId, setImportBankId] = useState('');
  const importFileRef = useRef(null);
  const newOpBtnRef = useRef(null);
  const [fabVisible, setFabVisible] = useState(false);
  const bankBalancesRef = useRef(null);
  const [totalBadgeVisible, setTotalBadgeVisible] = useState(false);
  // Modale de résolution des conflits d'import (N candidats pour un même montant).
  const [pendingMatches, setPendingMatches] = useState(null);
  // Conversion d'une opération en récurrente
  const [recurringForm, setRecurringForm] = useState(null); // null = fermé

  const loadOperations = () => operationsApi.list({ startDate, endDate }).then(setOperations);
  const loadBanks = () => banksApi.list().then(setBanks);

  useEffect(() => { loadBanks(); }, []); // chargement initial uniquement

  // FAB : visible dès que le bouton "Nouvelle opération" quitte le viewport
  useEffect(() => {
    const el = newOpBtnRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFabVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (startDate && endDate) operationsApi.list({ startDate, endDate }).then(setOperations);
  }, [startDate, endDate]);

  // Badge total : visible dès que la section BankBalances sort du viewport
  useEffect(() => {
    const el = bankBalancesRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setTotalBadgeVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [banks.length]);

  const handleSaveBalance = async (bankId, value) => {
    await banksApi.update(bankId, { currentBalance: value });
    loadBanks();
  };

  const handleGenerateRecurring = async () => {
    const today = dayjs();
    try {
      const { imported } = await operationsApi.generateRecurring({ month: today.month() + 1, year: today.year() });
      toast.success(`${imported} opération(s) générée(s)`);
      loadOperations();
      loadBanks();
    } catch (err) {
      toast.error(err.message || "Erreur lors de la génération");
    }
  };

  const handleFormFinish = async (values) => {
    try {
      if (editOp) await operationsApi.update(editOp._id, values);
      else await operationsApi.create(values);
      setFormOpen(false);
      setEditOp(null);
      loadOperations();
      loadBanks();
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'enregistrement");
    }
  };

  const handlePoint = async (id) => {
    await operationsApi.point(id);
    loadOperations();
    loadBanks(); // pointer/dépointer change le projectedBalance
  };

  const handleDelete = async (id) => {
    await operationsApi.remove(id);
    loadOperations();
    loadBanks();
  };

  const handleCategoryChange = async (id, category) => {
    await operationsApi.update(id, { category });
    loadOperations();
  };

  const openEdit = (op) => { setEditOp(op); setFormOpen(true); };

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

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    const file = importFileRef.current?.files?.[0];
    if (!file || !importBankId) return;
    try {
      const result = await operationsApi.importFile(file, { bankId: importBankId });
      const parts = [];
      if (result.imported) parts.push(`${result.imported} ajoutée(s)`);
      if (result.autoReconciled) parts.push(`${result.autoReconciled} pointée(s) auto`);
      if (result.duplicates) parts.push(`${result.duplicates} doublon(s)`);
      if (result.invalid) parts.push(`${result.invalid} invalide(s)`);
      toast.success(parts.join(' · ') || 'Aucune opération à importer');
      setImportOpen(false);
      setImportBankId('');
      if (importFileRef.current) importFileRef.current.value = '';
      loadOperations();
      loadBanks();
      // Conflits N-match : ouvre la modale de résolution.
      if (Array.isArray(result.pendingMatches) && result.pendingMatches.length > 0) {
        setPendingMatches(result.pendingMatches);
      }
    } catch (err) {
      // 10 s : le message d'erreur peut être détaillé (en-têtes du fichier),
      // on laisse le temps de lire avant fermeture.
      toast.error(err.message || 'Erreur lors de l\'import', { duration: 10000 });
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
      loadOperations();
      loadBanks();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la résolution', { duration: 10000 });
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
            onEdit={openEdit}
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

      <ImportResolveDialog
        open={!!pendingMatches}
        pendingMatches={pendingMatches || []}
        onResolve={handleResolveMatches}
        onCancel={() => setPendingMatches(null)}
      />

      <Dialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer un relevé</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleImportSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Banque</Label>
              <Select value={importBankId} onValueChange={setImportBankId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-file">Fichier QIF, OFX ou ZIP</Label>
              <input
                id="import-file"
                ref={importFileRef}
                type="file"
                accept=".qif,.ofx,.zip,application/zip"
                required
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white hover:file:bg-indigo-700"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              QIF ou OFX direct, ou ZIP contenant un de ces formats.
              Toutes les opérations du fichier sont importées (toutes dates),
              les doublons et lignes invalides sont ignorés.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!importBankId}>Importer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!recurringForm} onOpenChange={(o) => !o && setRecurringForm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Créer une opération récurrente</DialogTitle>
          </DialogHeader>
          {recurringForm && (
            <form onSubmit={handleRecurringSave} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="rec-label">Libellé</Label>
                <input
                  id="rec-label"
                  value={recurringForm.label}
                  onChange={(e) => setRecurringForm((f) => ({ ...f, label: e.target.value }))}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Jour du mois</Label>
                  <Select value={recurringForm.dayOfMonth} onValueChange={(v) => setRecurringForm((f) => ({ ...f, dayOfMonth: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rec-amount">Montant (€)</Label>
                  <input
                    id="rec-amount"
                    type="number"
                    step="0.01"
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Banque</Label>
                <Select value={recurringForm.bankId} onValueChange={(v) => setRecurringForm((f) => ({ ...f, bankId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={recurringForm.category} onValueChange={(v) => setRecurringForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sans catégorie</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c._id} value={c.label}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? DEFAULT_COLOR }} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRecurringForm(null)}>Annuler</Button>
                <Button type="submit" disabled={!recurringForm.bankId}>Créer la récurrente</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* FAB — apparaît quand le bouton "Nouvelle opération" est hors du viewport */}
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

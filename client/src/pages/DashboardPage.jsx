import { useEffect, useState, useMemo, useRef } from 'react';
import { CalendarDays, ChevronDown, Download, Plus, Upload } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as operationsApi from '@/api/operations';
import * as banksApi from '@/api/banks';
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

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function DashboardPage() {
  const { categories } = useCategories();
  const [banks, setBanks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);
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

  // Banks et operations sont rechargés à chaque changement de mois :
  // - operations dépend du mois (filtre serveur)
  // - banks porte projectedBalance, qui dépend des op non pointées (toutes dates)
  //   donc on ne le recalcule que quand on modifie une op (pas au changement de mois)
  const loadOperations = () => operationsApi.list({ month, year }).then(setOperations);
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
    operationsApi.list({ month, year }).then(setOperations);
  }, [month, year]);

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
    try {
      const { imported } = await operationsApi.generateRecurring({ month, year });
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
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <p className="text-sm">Aucune opération pour ce mois</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-foreground">{MONTHS[month - 1]} {year}</span>
            <span className="text-sm text-muted-foreground">{operations.length} opération(s)</span>
          </div>
          <OperationsTable
            operations={operations}
            categories={categories}
            onPoint={handlePoint}
            onEdit={openEdit}
            onDelete={handleDelete}
            onCategoryChange={handleCategoryChange}
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

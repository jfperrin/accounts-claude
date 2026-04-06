import { useEffect, useState, useMemo } from 'react';
import { CalendarDays, Download, Plus } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import * as banksApi from '@/api/banks';
import BankBalances from '@/components/BankBalances';
import OperationsTable from '@/components/OperationsTable';
import OperationForm from '@/components/OperationForm';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatEur } from '@/lib/utils';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

export default function DashboardPage() {
  const [periods, setPeriods] = useState([]);
  const [banks, setBanks] = useState([]);
  const [operations, setOperations] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editOp, setEditOp] = useState(null);
  const [month, setMonth] = useState(dayjs().month() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    Promise.all([periodsApi.list(), banksApi.list()]).then(([p, b]) => { setPeriods(p); setBanks(b); });
  }, []);

  useEffect(() => {
    const period = periods.find((p) => p.month === month && p.year === year);
    setSelectedPeriod(period ?? null);
    if (period) loadOperations(period._id);
    else setOperations([]);
  }, [periods, month, year]);

  const loadOperations = (periodId) => operationsApi.list(periodId).then((ops) => setOperations([...ops].sort((a, b) => new Date(a.date) - new Date(b.date))));

  const ensurePeriod = async () => {
    let period = selectedPeriod;
    if (!period) {
      period = await periodsApi.create({ month, year });
      setPeriods((prev) => [...prev, period]);
      setSelectedPeriod(period);
    }
    return period;
  };

  const handleSaveBalance = async (bankId, value) => {
    const period = await ensurePeriod();
    const current = { ...(period.balances ?? {}) };
    current[bankId] = value;
    const updated = await periodsApi.updateBalances(period._id, current);
    setPeriods((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setSelectedPeriod(updated);
  };

  const handleImport = async () => {
    try {
      const period = await ensurePeriod();
      const { imported } = await operationsApi.importRecurring(period._id);
      toast.success(`${imported} opération(s) importée(s)`);
      loadOperations(period._id);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'import');
    }
  };

  const handleFormFinish = async (values) => {
    try {
      const period = await ensurePeriod();
      if (editOp) await operationsApi.update(editOp._id, values);
      else await operationsApi.create({ ...values, periodId: period._id });
      setFormOpen(false);
      setEditOp(null);
      loadOperations(period._id);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'enregistrement');
    }
  };

  const handlePoint = async (id) => {
    await operationsApi.point(id);
    if (selectedPeriod) loadOperations(selectedPeriod._id);
  };

  const handleDelete = async (id) => {
    await operationsApi.remove(id);
    if (selectedPeriod) loadOperations(selectedPeriod._id);
  };

  const openEdit = (op) => { setEditOp(op); setFormOpen(true); };

  // Total prévisionnel toutes banques — utilisé pour la carte sticky mobile
  const totalProjected = useMemo(() => {
    const balances = selectedPeriod?.balances ?? {};
    const banksWithBalance = banks.filter((b) => balances[b._id] != null);
    if (banks.length < 2 || banksWithBalance.length === 0) return null;
    const unpointedSums = {};
    for (const o of operations) {
      if (!o.pointed) {
        const bid = o.bankId?._id ?? o.bankId;
        unpointedSums[bid] = (unpointedSums[bid] ?? 0) + o.amount;
      }
    }
    return banksWithBalance.reduce(
      (s, b) => s + balances[b._id] + (unpointedSums[b._id] ?? 0),
      0
    );
  }, [banks, operations, selectedPeriod]);

  return (
    <div className="space-y-4">
      {/* Total prévisionnel sticky — mobile uniquement */}
      {totalProjected !== null && (
        <div className="sticky top-[5px] z-10 md:hidden">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-3 shadow-lg shadow-indigo-500/30 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-200">Total prévisionnel</p>
            <span className="text-xl font-extrabold text-white">{formatEur(totalProjected)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-indigo-600" />
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleImport} className="gap-2">
          <Download className="h-4 w-4" />
          Importer récurrentes
        </Button>
        <Button onClick={() => { setEditOp(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle opération
        </Button>
      </div>

      {banks.length > 0 && (
        <>
          <BankBalances
            banks={banks}
            operations={operations}
            periodBalances={selectedPeriod?.balances ?? {}}
            onSaveBalance={handleSaveBalance}
          />
          <Separator />
        </>
      )}

      {operations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarDays className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">Aucune opération pour cette période</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-foreground">{MONTHS[month - 1]} {year}</span>
            <span className="text-sm text-muted-foreground">{operations.length} opération(s)</span>
          </div>
          <OperationsTable
            operations={operations}
            onPoint={handlePoint}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      <OperationForm
        open={formOpen}
        operation={editOp}
        banks={banks}
        onFinish={handleFormFinish}
        onCancel={() => { setFormOpen(false); setEditOp(null); }}
      />
    </div>
  );
}

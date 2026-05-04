import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { point } from '@/api/operations';
import { useBanks } from '@/hooks/useBanks';
import { useCategories } from '@/hooks/useCategories';
import { useOperations } from '@/hooks/useOperations';
import { useRecurringOperations } from '@/hooks/useRecurringOperations';
import { useUnpointedOperations } from '@/hooks/useUnpointedOperations';
import HomeBankCards from '@/components/HomeBankCards';
import BudgetSummary from '@/components/BudgetSummary';
import ExpensesByCategoryChart from '@/components/ExpensesByCategoryChart';
import MonthlyComparison from '@/components/MonthlyComparison';
import ProjectionSummary from '@/components/ProjectionSummary';
import FutureBalanceChart from '@/components/FutureBalanceChart';
import UnpointedOperationsList from '@/components/UnpointedOperationsList';

const COOKIE_NAME = 'home_date_range';
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

export default function HomePage() {
  const { banks } = useBanks();
  const { categories } = useCategories();
  const { recurring } = useRecurringOperations();
  const { operations: unpointed, reload: reloadUnpointed } = useUnpointedOperations();

  const [rangeMode, setRangeModeRaw] = useState(() => getCookiePref()?.mode ?? '30d');
  const [customStart, setCustomStart] = useState(() => getCookiePref()?.start ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(() => getCookiePref()?.end ?? dayjs().format('YYYY-MM-DD'));

  const setRangeMode = (mode) => { setRangeModeRaw(mode); setCookiePref({ mode, start: customStart, end: customEnd }); };
  const updateCustomStart = (v) => { setCustomStart(v); setCookiePref({ mode: rangeMode, start: v, end: customEnd }); };
  const updateCustomEnd = (v) => { setCustomEnd(v); setCookiePref({ mode: rangeMode, start: customStart, end: v }); };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return {
      startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    };
    if (rangeMode === '90d') return {
      startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    };
    if (rangeMode === 'month') return {
      startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
    };
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd]);

  // Operations sur la période, pour le calcul du budget réel.
  const { operations } = useOperations({ startDate, endDate });

  // 6 mois pleins + mois courant : sert à la comparaison N/N-1 et à la
  // moyenne ponctuelle alimentant les projections. Range stable au montage.
  const forecastRange = useMemo(() => ({
    startDate: dayjs().subtract(6, 'month').startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  }), []);
  const { operations: history } = useOperations(forecastRange);

  const handlePoint = async (id) => {
    try {
      await point(id);
      reloadUnpointed();
    } catch (err) {
      toast.error(err.message || 'Erreur lors du pointage');
    }
  };

  return (
    <div className="space-y-4">
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
      </div>

      {banks.length > 0 && (
        <HomeBankCards banks={banks} unpointed={unpointed} endDate={endDate} />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetSummary
          categories={categories}
          recurring={recurring}
          operations={operations}
          startDate={startDate}
          endDate={endDate}
        />
        <ExpensesByCategoryChart categories={categories} operations={operations} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyComparison operations={history} />
        <ProjectionSummary banks={banks} recurring={recurring} history={history} />
      </div>

      <FutureBalanceChart banks={banks} recurring={recurring} history={history} />

      <UnpointedOperationsList operations={unpointed} onPoint={handlePoint} />
    </div>
  );
}

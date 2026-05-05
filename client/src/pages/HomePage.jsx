import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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

function formatRange(startDate, endDate) {
  const s = dayjs(startDate);
  const e = dayjs(endDate);
  const startFmt = s.year() === e.year() ? s.format('D MMM') : s.format('D MMM YYYY');
  return `${startFmt} → ${e.format('D MMM YYYY')}`;
}

export default function HomePage() {
  const { banks } = useBanks();
  const { categories } = useCategories();
  const { recurring } = useRecurringOperations();
  const { operations: unpointed, reload: reloadUnpointed } = useUnpointedOperations();

  const [rangeMode, setRangeModeRaw] = useState(() => getCookiePref()?.mode ?? '30d');
  const [customStart, setCustomStart] = useState(() => getCookiePref()?.start ?? dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(() => getCookiePref()?.end ?? dayjs().format('YYYY-MM-DD'));
  const [monthOffset, setMonthOffsetRaw] = useState(() => getCookiePref()?.monthOffset ?? 0);

  const persist = (over) => setCookiePref({
    mode: rangeMode, start: customStart, end: customEnd, monthOffset, ...over,
  });
  const setRangeMode = (mode) => { setRangeModeRaw(mode); persist({ mode }); };
  const updateCustomStart = (v) => { setCustomStart(v); persist({ start: v }); };
  const updateCustomEnd = (v) => { setCustomEnd(v); persist({ end: v }); };
  const setMonthOffset = (v) => { setMonthOffsetRaw(v); persist({ monthOffset: v }); };

  const { startDate, endDate } = useMemo(() => {
    if (rangeMode === '30d') return {
      startDate: dayjs().subtract(29, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    };
    if (rangeMode === '90d') return {
      startDate: dayjs().subtract(89, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    };
    if (rangeMode === 'month') {
      const m = dayjs().add(monthOffset, 'month');
      return {
        startDate: m.startOf('month').format('YYYY-MM-DD'),
        endDate: m.endOf('month').format('YYYY-MM-DD'),
      };
    }
    return { startDate: customStart, endDate: customEnd };
  }, [rangeMode, customStart, customEnd, monthOffset]);

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
            <span className="min-w-[110px] text-center text-sm font-medium tabular-nums capitalize">
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
        {rangeMode !== 'custom' && rangeMode !== 'month' && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatRange(startDate, endDate)}
          </span>
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
        <ExpensesByCategoryChart
          categories={categories}
          operations={operations}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyComparison operations={history} categories={categories} />
        <ProjectionSummary banks={banks} recurring={recurring} history={history} categories={categories} />
      </div>

      <UnpointedOperationsList operations={unpointed} onPoint={handlePoint} />
    </div>
  );
}

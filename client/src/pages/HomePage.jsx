import { useMemo, useState, lazy, Suspense } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { point } from '@/api/operations';
import { useBanks } from '@/hooks/useBanks';
import { useCategories } from '@/hooks/useCategories';
import { useOperations } from '@/hooks/useOperations';
import { useRecurringOperations } from '@/hooks/useRecurringOperations';
import { useUnpointedOperations } from '@/hooks/useUnpointedOperations';
import BudgetSummary from '@/components/BudgetSummary';
import MonthlyComparison from '@/components/MonthlyComparison';
import ExpenseRatioCard from '@/components/ExpenseRatioCard';
import BalanceSummary from '@/components/BalanceSummary';
import MonthlyInsights from '@/components/MonthlyInsights';
import UnpointedOperationsList from '@/components/UnpointedOperationsList';
import OnboardingSteps from '@/components/OnboardingSteps';
import ChartFallback from '@/components/ChartFallback';
import { TooltipProvider } from '@/components/ui/tooltip';

// recharts représente ~120 ko gzip — sorti du chunk principal via lazy().
const ExpensesByCategoryChart = lazy(() => import('@/components/ExpensesByCategoryChart'));
const RealBalanceChart = lazy(() => import('@/components/RealBalanceChart'));

// Cookie propre à HomePage (désynchronisé de OperationsPage). Stocke juste
// le `monthOffset` (0 = mois en cours, défaut quand aucun cookie).
const COOKIE_NAME = 'home_month';

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

  const [monthOffset, setMonthOffsetRaw] = useState(() => getCookiePref()?.monthOffset ?? 0);
  const setMonthOffset = (v) => {
    setMonthOffsetRaw(v);
    setCookiePref({ monthOffset: v });
  };

  const { startDate, endDate } = useMemo(() => {
    const m = dayjs().add(monthOffset, 'month');
    return {
      startDate: m.startOf('month').format('YYYY-MM-DD'),
      endDate: m.endOf('month').format('YYYY-MM-DD'),
    };
  }, [monthOffset]);

  // Operations sur le mois sélectionné — alimente Budget, graphe et ratio.
  const { operations: rawOperations } = useOperations({ startDate, endDate });

  // 6 mois pleins glissants pour calculer la moyenne ponctuelle historique
  // utilisée par MonthlyInsights. Range stable au montage.
  const historyRange = useMemo(() => ({
    startDate: dayjs().subtract(6, 'month').startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('day').format('YYYY-MM-DD'),
  }), []);
  const { operations: rawHistory } = useOperations(historyRange);

  // Opérations du mois précédent du sélectionné (pour MonthlyComparison).
  const comparisonRange = useMemo(() => {
    const sel = dayjs().add(monthOffset, 'month');
    const prev = sel.subtract(1, 'month');
    return {
      startDate: prev.startOf('month').format('YYYY-MM-DD'),
      endDate: sel.endOf('month').format('YYYY-MM-DD'),
    };
  }, [monthOffset]);
  const { operations: rawComparisonOps } = useOperations(comparisonRange);

  // Exclut les virements internes des agrégations dépense/revenu : ils sont
  // neutres au global (une banque sort, l'autre rentre) et fausseraient les
  // graphes/budgets s'ils étaient comptés comme dépenses ou revenus.
  const operations = useMemo(() => rawOperations.filter((o) => !o.transferId), [rawOperations]);
  const history = useMemo(() => rawHistory.filter((o) => !o.transferId), [rawHistory]);
  const comparisonOps = useMemo(() => rawComparisonOps.filter((o) => !o.transferId), [rawComparisonOps]);

  const handlePoint = async (id) => {
    try {
      await point(id);
      reloadUnpointed();
    } catch (err) {
      toast.error(err.message || 'Erreur lors du pointage');
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <OnboardingSteps banks={banks} operations={rawOperations} categories={categories} recurring={recurring} />

      {banks.length > 0 && <BalanceSummary banks={banks} />}

      {banks.length > 0 && (
        <UnpointedOperationsList operations={unpointed} onPoint={handlePoint} />
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-primary shrink-0" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonthOffset(monthOffset - 1)}
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
              className="ml-1 text-xs text-primary hover:underline"
            >
              Auj.
            </button>
          )}
        </div>
      </div>

      <MonthlyInsights
        operations={operations}
        comparisonOps={comparisonOps}
        history={history}
        categories={categories}
        recurring={recurring}
        banks={banks}
        unpointed={unpointed}
        monthOffset={monthOffset}
        startDate={startDate}
        endDate={endDate}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetSummary
          categories={categories}
          recurring={recurring}
          operations={operations}
        />
        <Suspense fallback={<ChartFallback height={300} />}>
          <ExpensesByCategoryChart
            categories={categories}
            operations={operations}
            startDate={startDate}
            endDate={endDate}
          />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyComparison
          operations={comparisonOps}
          categories={categories}
          monthOffset={monthOffset}
        />
        <ExpenseRatioCard operations={operations} categories={categories} history={history} />
      </div>

      {banks.length > 0 && (
        <Suspense fallback={<ChartFallback height={320} />}>
          <RealBalanceChart
            banks={banks}
            operations={operations}
            history={history}
            monthOffset={monthOffset}
          />
        </Suspense>
      )}
    </div>
    </TooltipProvider>
  );
}

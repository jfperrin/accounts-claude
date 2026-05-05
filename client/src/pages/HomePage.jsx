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

// Cookie partagé avec OperationsPage pour conserver la période sélectionnée
// d'une page à l'autre. HomePage ne pilote que `monthOffset` (et force
// `mode: 'month'` pour que la page Opérations reflète le même mois).
const COOKIE_NAME = 'dash_date_range';

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
    setCookiePref({ ...(getCookiePref() ?? {}), mode: 'month', monthOffset: v });
  };

  const { startDate, endDate } = useMemo(() => {
    const m = dayjs().add(monthOffset, 'month');
    return {
      startDate: m.startOf('month').format('YYYY-MM-DD'),
      endDate: m.endOf('month').format('YYYY-MM-DD'),
    };
  }, [monthOffset]);

  // Operations sur le mois sélectionné — alimente Budget et graphe.
  const { operations } = useOperations({ startDate, endDate });

  // 12 mois pleins glissants : couvre le mois précédent du sélectionné pour la
  // comparaison N/N-1, et alimente la moyenne ponctuelle de la projection
  // (filtre interne sur 6 mois). Range stable au montage.
  const historyRange = useMemo(() => ({
    startDate: dayjs().subtract(12, 'month').startOf('month').format('YYYY-MM-DD'),
    endDate: dayjs().format('YYYY-MM-DD'),
  }), []);
  const { operations: history } = useOperations(historyRange);

  // Opérations du mois précédent du sélectionné (pour MonthlyComparison) —
  // peut sortir de historyRange si on navigue loin dans le passé.
  const comparisonRange = useMemo(() => {
    const sel = dayjs().add(monthOffset, 'month');
    const prev = sel.subtract(1, 'month');
    return {
      startDate: prev.startOf('month').format('YYYY-MM-DD'),
      endDate: sel.endOf('month').format('YYYY-MM-DD'),
    };
  }, [monthOffset]);
  const { operations: comparisonOps } = useOperations(comparisonRange);

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
      {banks.length > 0 && (
        <HomeBankCards banks={banks} unpointed={unpointed} endDate={endDate} />
      )}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2 sm:p-4 shadow-xs">
        <CalendarDays className="h-5 w-5 text-indigo-600 shrink-0" />
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
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BudgetSummary
          categories={categories}
          recurring={recurring}
          operations={operations}
        />
        <ExpensesByCategoryChart
          categories={categories}
          operations={operations}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyComparison
          operations={comparisonOps}
          categories={categories}
          monthOffset={monthOffset}
        />
        <ProjectionSummary banks={banks} recurring={recurring} history={history} categories={categories} />
      </div>

      <UnpointedOperationsList operations={unpointed} onPoint={handlePoint} />
    </div>
  );
}

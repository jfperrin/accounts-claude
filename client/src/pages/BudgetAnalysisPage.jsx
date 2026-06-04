import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBudgetAnalysis } from '@/hooks/useBudgetAnalysis';
import { useCategories } from '@/hooks/useCategories';
import { getCookiePref, setCookiePref } from '@/lib/cookieUtils';
import AnalysisDisplay from '@/components/budgetAnalysis/AnalysisDisplay';

const COOKIE_NAME = 'analysis_month';

export default function BudgetAnalysisPage() {
  const [monthOffset, setMonthOffsetRaw] = useState(
    () => getCookiePref(COOKIE_NAME)?.monthOffset ?? 0,
  );
  const setMonthOffset = (next) => {
    setMonthOffsetRaw((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      setCookiePref(COOKIE_NAME, { monthOffset: v });
      return v;
    });
  };

  const { year, month, label } = useMemo(() => {
    const m = dayjs().add(monthOffset, 'month');
    return { year: m.year(), month: m.month() + 1, label: m.format('MMMM YYYY') };
  }, [monthOffset]);

  const { categories } = useCategories();
  const {
    analysis, meta, status, error, appliedIds, run, regenerate, applySuggestion,
  } = useBudgetAnalysis({ year, month });

  const canGoForward = monthOffset < 0;
  const canGoBack    = monthOffset > -24;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Analyse budgétaire IA</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!canGoBack}
            onClick={() => setMonthOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-medium capitalize">{label}</span>
          <Button variant="ghost" size="icon" disabled={!canGoForward}
            onClick={() => setMonthOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {status === 'idle' && (
            <Button onClick={() => run()}>
              <Sparkles className="mr-1.5 h-4 w-4" />Analyser ce mois
            </Button>
          )}
          {(status === 'ready' || status === 'stale') && (
            <Button variant="outline" onClick={regenerate}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Régénérer
            </Button>
          )}
        </div>
      </header>

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Claude analyse les opérations du mois…
        </div>
      )}

      {status === 'stale' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-debit/40 bg-debit/10 p-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Les opérations du mois ont changé depuis cette analyse.
          </span>
          <Button size="sm" variant="outline" onClick={regenerate}>Régénérer</Button>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => run()}>Réessayer</Button>
        </div>
      )}

      {status === 'idle' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune analyse pour {label}. Cliquez sur <strong>Analyser ce mois</strong> pour générer une analyse Claude.
          </p>
        </div>
      )}

      {analysis && (status === 'ready' || status === 'stale') && (
        <AnalysisDisplay
          analysis={analysis} categories={categories}
          appliedIds={appliedIds} onApply={applySuggestion}
          meta={meta}
        />
      )}
    </div>
  );
}

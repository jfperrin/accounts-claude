import { lazy, Suspense } from 'react';
import SummaryCard from './SummaryCard';
import HighlightsList from './HighlightsList';
import AnomaliesList from './AnomaliesList';
import TrendsList from './TrendsList';
import BudgetSuggestionsCard from './BudgetSuggestionsCard';
import ChartFallback from '@/components/ChartFallback';

const CategoryDonut = lazy(() => import('./CategoryDonut'));

export default function AnalysisDisplay({ analysis, categories, meta, appliedIds, onApply }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2">
        <SummaryCard summary={analysis.summary} meta={meta} />
      </div>
      <HighlightsList highlights={analysis.highlights} />
      <AnomaliesList anomalies={analysis.anomalies} categories={categories} />
      <TrendsList trends={analysis.trends} categories={categories} />
      <Suspense fallback={<ChartFallback height={260} />}>
        <CategoryDonut data={analysis.categoryBreakdown} categories={categories} />
      </Suspense>
      <div className="md:col-span-2">
        <BudgetSuggestionsCard
          suggestions={analysis.budgetSuggestions}
          categories={categories}
          appliedIds={appliedIds}
          onApply={onApply}
        />
      </div>
    </div>
  );
}

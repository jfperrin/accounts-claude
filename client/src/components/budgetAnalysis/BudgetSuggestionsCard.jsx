import { useState } from 'react';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryBadge from '@/components/CategoryBadge';
import { formatEur } from '@/lib/utils';

export default function BudgetSuggestionsCard({ suggestions, categories, appliedIds, onApply }) {
  const [busyId, setBusyId] = useState(null);
  if (!suggestions?.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Suggestions de budget</h2>
      <ul className="divide-y divide-border">
        {suggestions.map((s) => {
          const isApplied = appliedIds.has(s.categoryId);
          const delta = s.suggestedBudget - s.currentBudget;
          return (
            <li key={s.categoryId}
              className={`flex flex-wrap items-center gap-3 py-2.5 ${isApplied ? 'opacity-60' : ''}`}>
              <div className="min-w-[8rem]">
                <CategoryBadge categoryId={s.categoryId} categories={categories} />
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">{formatEur(s.currentBudget)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{formatEur(s.suggestedBudget)}</span>
                <span className={`ml-1 text-xs ${delta >= 0 ? 'text-debit' : 'text-credit'}`}>
                  ({delta >= 0 ? '+' : ''}{formatEur(delta)})
                </span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">{s.rationale}</p>
              {isApplied ? (
                <span className="inline-flex items-center gap-1 text-xs text-credit">
                  <Check className="h-3.5 w-3.5" /> Appliqué
                </span>
              ) : (
                <Button size="sm" variant="outline"
                  disabled={busyId === s.categoryId || delta === 0}
                  onClick={async () => {
                    setBusyId(s.categoryId);
                    try {
                      await onApply({ categoryId: s.categoryId, suggestedBudget: s.suggestedBudget });
                    } finally { setBusyId(null); }
                  }}>
                  {busyId === s.categoryId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : 'Appliquer'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

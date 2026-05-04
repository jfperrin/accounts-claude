import { useState } from 'react';
import { Sparkles, Plus, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { dismissSuggestion } from '@/api/recurringOperations';
import { cn, formatEur } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CategoryBadge from '@/components/CategoryBadge';

// Affiche les suggestions détectées (état contrôlé par le parent).
//   suggestions = null  → rien afficher (jamais scanné)
//                = []   → carte "aucune détection"
//                = [..] → liste
//   loading             → carte avec spinner
export default function RecurringSuggestions({
  suggestions, loading, categories, onCreate, onChange,
}) {
  const [expanded, setExpanded] = useState({});

  const onDismiss = async (s) => {
    try {
      await dismissSuggestion(s.key);
      onChange(suggestions.filter((x) => x.key !== s.key));
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          Analyse de l&apos;historique en cours…
        </div>
      </div>
    );
  }

  if (suggestions === null) return null;

  if (suggestions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Aucune récurrente détectée dans l&apos;historique.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-xs dark:border-indigo-900/50 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-sm font-semibold">Suggestions de récurrentes</h2>
        <span className="text-xs text-muted-foreground">
          {suggestions.length} détectée{suggestions.length > 1 ? 's' : ''}
        </span>
      </div>

      <ul className="space-y-2">
        {suggestions.map((s) => {
          const isOpen = !!expanded[s.key];
          return (
            <li
              key={s.key}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.label}</span>
                    {s.bank && <Badge variant="secondary">{s.bank.label}</Badge>}
                    {s.categoryId && (
                      <CategoryBadge categoryId={s.categoryId} categories={categories} />
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>~le {s.dayOfMonth} du mois</span>
                    <span>·</span>
                    <span>{s.occurrences.length} occurrences</span>
                    <button
                      type="button"
                      onClick={() => setExpanded((p) => ({ ...p, [s.key]: !isOpen }))}
                      className="inline-flex items-center gap-0.5 text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      détails
                    </button>
                  </div>
                </div>
                <span className={cn(
                  'tabular-nums font-semibold whitespace-nowrap',
                  s.amount >= 0 ? 'text-emerald-600' : 'text-rose-600',
                )}>
                  {s.amount > 0 ? '+' : ''}{formatEur(s.amount)}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => onCreate(s)} className="gap-1">
                    <Plus className="h-3.5 w-3.5" />
                    Créer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDismiss(s)}
                    className="gap-1 text-muted-foreground hover:text-foreground"
                    title="Ignorer cette suggestion"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  {s.occurrences.map((o) => (
                    <li key={o._id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{o.label}</span>
                      <span className="tabular-nums">
                        {new Date(o.date).toLocaleDateString('fr-FR')} · {formatEur(o.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

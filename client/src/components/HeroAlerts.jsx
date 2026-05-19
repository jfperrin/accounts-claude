import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMonthlyInsights } from '@/hooks/useMonthlyInsights';
import InsightItem from '@/components/InsightItem';

// Pose les 2 signaux critical/warning prioritaires juste sous le Hero
// Horizon. Le reste (warnings supplémentaires + info + positive) est plié
// derrière une disclosure « N autres signaux ▾ ».
//
// Quand il n'y a aucun signal critical/warning, on bascule en mode replié
// par défaut avec un teaser compact — l'utilisateur peut tout de même
// déplier les info/positive d'un clic.
export default function HeroAlerts(props) {
  const insights = useMonthlyInsights(props);
  const [expanded, setExpanded] = useState(false);

  const { top, rest } = useMemo(() => {
    const top = [];
    const rest = [];
    for (const ins of insights) {
      if (top.length < 2 && (ins.severity === 'critical' || ins.severity === 'warning')) {
        top.push(ins);
      } else {
        rest.push(ins);
      }
    }
    return { top, rest };
  }, [insights]);

  if (insights.length === 0) return null;

  // Aucune alerte prioritaire : teaser compact replié par défaut.
  if (top.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <span>
            {insights.length} signal{insights.length > 1 ? 'aux' : ''} d&apos;analyse du mois
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {expanded && (
          <ul className="space-y-2 px-2 pb-2">
            {insights.map((it, i) => <InsightItem key={i} {...it} />)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {top.map((it, i) => <InsightItem key={`top-${i}`} {...it} />)}
      </ul>
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex w-full items-center justify-center gap-1 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded
              ? 'Replier'
              : `${rest.length} autre${rest.length > 1 ? 's' : ''} signal${rest.length > 1 ? 'aux' : ''}`}
          </button>
          {expanded && (
            <ul className="space-y-2">
              {rest.map((it, i) => <InsightItem key={`rest-${i}`} {...it} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

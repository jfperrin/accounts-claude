import { Sparkles } from 'lucide-react';
import { useMonthlyInsights } from '@/hooks/useMonthlyInsights';
import InfoTip from '@/components/InfoTip';
import InsightItem from '@/components/InsightItem';

// Vue complète des signaux mensuels. Pour la home, préférer <HeroAlerts /> qui
// remonte les 2 critiques/warnings en tête + plie le reste. Ce composant reste
// utile pour un panneau « Vue détaillée » exhaustif.
export default function MonthlyInsights(props) {
  const insights = useMonthlyInsights(props);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Analyse du mois
          <InfoTip>
            Synthèse automatique des points marquants de la période :
            dépassements de budget, rythme de dépenses, anomalies (dépense
            atypique), comparaison vs mois précédent, signaux de qualité.
            Trié par criticité (rouge → orange → bleu → vert). Les signaux
            liés au temps réel (rythme, projection, récurrentes manquantes)
            ne sortent que sur le mois en cours.
          </InfoTip>
        </h2>
        {insights.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {insights.length} signal{insights.length > 1 ? 'aux' : ''}
          </p>
        )}
      </div>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Rien à signaler : aucun point critique détecté sur la période.
        </p>
      ) : (
        <ul className="space-y-2">
          {insights.map((it, i) => <InsightItem key={i} {...it} />)}
        </ul>
      )}
    </div>
  );
}

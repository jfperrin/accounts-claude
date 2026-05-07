import { useMemo } from 'react';
import dayjs from 'dayjs';
import {
  AlertCircle, AlertTriangle, Info, Sparkles, Tag, TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn, formatEur } from '@/lib/utils';
import InfoTip from '@/components/InfoTip';

// Heuristique d'analyse mensuelle. Génère des signaux triés par criticité
// (critical > warning > info > positive). Conventions courantes en
// budgétaire personnel : règle 50/30/20 (épargne ≥ 20% des revenus),
// variance analysis (réel vs prévu, top dépassements), pacing (consommé
// vs % du mois écoulé), anomalies (médiane × N), comparaison N/N-1.
//
// Les signaux dépendant du temps réel (rythme, projection, récurrentes
// manquantes) ne sortent que si on regarde le mois en cours.

function directional(sum, kind) {
  return kind === 'credit' ? Math.max(0, sum) : Math.max(0, -sum);
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2, positive: 3 };

export default function MonthlyInsights({
  operations = [], comparisonOps = [], history = [], categories = [],
  recurring = [], banks = [], unpointed = [], monthOffset = 0,
  startDate, endDate,
}) {
  const insights = useMemo(() => {
    const items = [];
    const isCurrent = monthOffset === 0;
    const today = dayjs();
    const start = dayjs(startDate);
    const end = dayjs(endDate);

    const catById = new Map(categories.map((c) => [String(c._id), c]));

    let revenus = 0; let depenses = 0;
    for (const o of operations) {
      if (!o.categoryId) continue;
      const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
      if (!cat || cat.kind === 'transfer') continue;
      if (cat.kind === 'credit') revenus += Math.max(0, o.amount);
      else depenses += Math.max(0, -o.amount);
    }
    const net = revenus - depenses;

    // 1. Solde projeté en fin de mois négatif (mois en cours uniquement).
    //    Transferts internes exclus pour rester homogène avec les autres
    //    signaux (et éviter les distorsions quand une seule jambe d'un
    //    virement est encore en attente).
    if (isCurrent && banks.length > 0) {
      const totalCurrent = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
      const cap = end.endOf('day');
      const pending = unpointed
        .filter((o) => {
          const d = dayjs(o.date);
          if (!(d.isBefore(cap) || d.isSame(cap))) return false;
          if (!o.categoryId) return true;
          const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
          return !cat || cat.kind !== 'transfer';
        })
        .reduce((s, o) => s + o.amount, 0);
      const projectedAtEnd = totalCurrent + pending;
      if (projectedAtEnd < 0) {
        items.push({
          severity: 'critical',
          icon: AlertCircle,
          title: 'Solde projeté négatif en fin de mois',
          message: `Avec les opérations en attente, le solde tombera à ${formatEur(projectedAtEnd)}. Anticipez un découvert.`,
        });
      } else if (projectedAtEnd < 200 && totalCurrent > 0) {
        items.push({
          severity: 'warning',
          icon: AlertTriangle,
          title: 'Solde de fin de mois faible',
          message: `Projection : ${formatEur(projectedAtEnd)}. Marge de sécurité réduite.`,
        });
      }
    }

    // 2. Solde du mois (déficit / épargne)
    if (revenus > 0 || depenses > 0) {
      if (net < 0 && revenus > 0) {
        const ratio = (Math.abs(net) / revenus) * 100;
        items.push({
          severity: ratio > 20 ? 'warning' : 'info',
          icon: TrendingDown,
          title: 'Mois déficitaire',
          message: `Net : ${formatEur(net)} (-${ratio.toFixed(0)}% des revenus). Dépenses ${formatEur(depenses)} > Revenus ${formatEur(revenus)}.`,
        });
      } else if (net < 0 && revenus === 0 && depenses > 0) {
        items.push({
          severity: 'info',
          icon: TrendingDown,
          title: 'Aucun revenu sur la période',
          message: `Dépenses : ${formatEur(depenses)}.`,
        });
      }
    }

    // 3. Catégories en dépassement (variance analysis)
    const recByCat = new Map();
    for (const r of recurring) {
      const id = r.categoryId ? String(r.categoryId?._id ?? r.categoryId) : null;
      if (!id) continue;
      recByCat.set(id, (recByCat.get(id) ?? 0) + r.amount);
    }
    const actualByCat = new Map();
    for (const o of operations) {
      if (!o.categoryId) continue;
      const id = String(o.categoryId?._id ?? o.categoryId);
      actualByCat.set(id, (actualByCat.get(id) ?? 0) + o.amount);
    }
    const overruns = [];
    for (const c of categories) {
      if (c.kind !== 'debit') continue;
      const recSum = directional(recByCat.get(String(c._id)) ?? 0, c.kind);
      const rawBudget = recSum + (c.maxAmount ?? 0);
      const budget = Math.ceil(rawBudget / 10) * 10;
      const actual = directional(actualByCat.get(String(c._id)) ?? 0, c.kind);
      if (budget > 0 && actual > budget) {
        overruns.push({ cat: c, over: actual - budget });
      }
    }
    overruns.sort((a, b) => b.over - a.over);
    if (overruns.length > 0) {
      const top = overruns.slice(0, 3);
      const summary = top.map((o) => `${o.cat.label} (+${formatEur(o.over)})`).join(', ');
      items.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: `${overruns.length} catégorie${overruns.length > 1 ? 's' : ''} en dépassement`,
        message: summary + (overruns.length > 3 ? `, et ${overruns.length - 3} autre${overruns.length - 3 > 1 ? 's' : ''}` : '') + '.',
      });
    }

    // 4. Rythme de dépenses (mois en cours uniquement)
    if (isCurrent && depenses > 0) {
      const elapsed = today.diff(start, 'day') + 1;
      const totalDays = end.diff(start, 'day') + 1;
      if (elapsed > 0 && elapsed < totalDays) {
        const pctElapsed = elapsed / totalDays;
        let budgetDebit = 0;
        for (const c of categories) {
          if (c.kind !== 'debit') continue;
          const recSum = directional(recByCat.get(String(c._id)) ?? 0, c.kind);
          const rawBudget = recSum + (c.maxAmount ?? 0);
          budgetDebit += Math.ceil(rawBudget / 10) * 10;
        }
        if (budgetDebit > 0) {
          const pctSpent = depenses / budgetDebit;
          const overpace = pctSpent - pctElapsed;
          if (overpace > 0.15) {
            items.push({
              severity: pctSpent > 1 ? 'warning' : 'info',
              icon: TrendingUp,
              title: 'Rythme de dépenses élevé',
              message: `${(pctSpent * 100).toFixed(0)}% du budget consommé au jour ${elapsed}/${totalDays} (attendu ~${(pctElapsed * 100).toFixed(0)}%). ${formatEur(depenses)} sur ${formatEur(budgetDebit)}.`,
            });
          } else if (overpace < -0.2 && pctElapsed > 0.5) {
            items.push({
              severity: 'positive',
              icon: TrendingDown,
              title: 'Rythme de dépenses contenu',
              message: `${(pctSpent * 100).toFixed(0)}% du budget seulement au jour ${elapsed}/${totalDays}.`,
            });
          }
        }
      }
    }

    // 5. Dépense exceptionnelle (anomalie : > 5× la médiane). On exclut les
    //    opérations issues d'une récurrente (loyer, abonnements, etc.) pour
    //    ne pas les signaler comme atypiques. Match : même banque + libellé
    //    exact ou suffixé `(rowLabel)` après réconciliation à l'import +
    //    montant à ±10 %.
    const isFromRecurring = (op) => {
      const opBank = String(op.bankId?._id ?? op.bankId);
      const opLabel = op.label || '';
      for (const r of recurring) {
        if (r.amount === 0 || op.amount === 0) continue;
        if (Math.sign(r.amount) !== Math.sign(op.amount)) continue;
        const rBank = String(r.bankId?._id ?? r.bankId);
        if (rBank !== opBank) continue;
        if (opLabel !== r.label && !opLabel.startsWith(`${r.label} (`)) continue;
        if (Math.abs(op.amount - r.amount) > Math.abs(r.amount) * 0.10) continue;
        return true;
      }
      return false;
    };
    const expenses = operations
      .filter((o) => o.amount < 0)
      .filter((o) => {
        if (!o.categoryId) return true;
        const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
        return !cat || cat.kind !== 'transfer';
      })
      .filter((o) => !isFromRecurring(o))
      .sort((a, b) => a.amount - b.amount);
    if (expenses.length >= 5) {
      const biggest = expenses[0];
      const sortedAbs = expenses.map((o) => Math.abs(o.amount)).sort((a, b) => a - b);
      const median = sortedAbs[Math.floor(sortedAbs.length / 2)];
      const ratio = median > 0 ? Math.abs(biggest.amount) / median : 0;
      if (ratio >= 5) {
        items.push({
          severity: 'info',
          icon: Info,
          title: 'Dépense exceptionnelle',
          message: `${biggest.label} : ${formatEur(biggest.amount)} le ${dayjs(biggest.date).format('DD/MM')}, soit ${ratio.toFixed(0)}× la dépense médiane du mois.`,
        });
      }
    }

    // 6. vs mois précédent (net)
    if (comparisonOps.length > 0) {
      const prevStart = start.subtract(1, 'month').startOf('month');
      const prevEnd = prevStart.endOf('month');
      let prevRevenus = 0; let prevDepenses = 0;
      for (const o of comparisonOps) {
        if (!o.categoryId) continue;
        const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
        if (!cat || cat.kind === 'transfer') continue;
        const d = dayjs(o.date);
        if (d.isBefore(prevStart) || d.isAfter(prevEnd)) continue;
        if (cat.kind === 'credit') prevRevenus += Math.max(0, o.amount);
        else prevDepenses += Math.max(0, -o.amount);
      }
      const prevNet = prevRevenus - prevDepenses;
      if (Math.abs(prevNet) > 50 && (revenus + depenses) > 0) {
        const change = net - prevNet;
        const pct = Math.abs(change / prevNet) * 100;
        if (pct >= 25) {
          const better = change > 0;
          items.push({
            severity: better ? 'positive' : 'warning',
            icon: better ? TrendingUp : TrendingDown,
            title: `Net ${better ? 'meilleur' : 'plus faible'} que le mois précédent`,
            message: `Net ce mois : ${formatEur(net)} ; mois précédent : ${formatEur(prevNet)}. Écart : ${better ? '+' : ''}${formatEur(change)} (${better ? '+' : ''}${pct.toFixed(0)} %).`,
          });
        }
      }
    }

    // 7. Sans catégorie significatif (signal qualité de données).
    //    On exclut les transferts du dénominateur pour ne pas diluer
    //    artificiellement le ratio quand l'utilisateur fait beaucoup de
    //    virements internes.
    let uncatTotal = 0; let totalVolume = 0; let uncatCount = 0;
    for (const o of operations) {
      if (o.categoryId) {
        const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
        if (cat && cat.kind === 'transfer') continue;
      }
      const abs = Math.abs(o.amount);
      totalVolume += abs;
      if (!o.categoryId) { uncatTotal += abs; uncatCount += 1; }
    }
    if (totalVolume > 0 && uncatTotal / totalVolume > 0.1 && uncatCount >= 3) {
      items.push({
        severity: 'info',
        icon: Tag,
        title: `${uncatCount} opération${uncatCount > 1 ? 's' : ''} non catégorisée${uncatCount > 1 ? 's' : ''}`,
        message: `${formatEur(uncatTotal)} non classés (${(uncatTotal / totalVolume * 100).toFixed(0)}% du volume). Catégorisez pour des analyses plus fines.`,
      });
    }

    // 9. Moyenne ponctuelle historique (hors récurrentes) — repère
    //    "habituel" sur 6 mois pleins glissants. Permet de détecter une
    //    dérive vs comportement passé indépendamment du budget théorique,
    //    et d'alerter quand la marge restante (cash − récurrentes à venir)
    //    risque de ne pas couvrir les ponctuelles habituelles du mois.
    const recurringDebitTotal = recurring.reduce((s, r) => {
      if (!r.categoryId) return s;
      const cat = catById.get(String(r.categoryId?._id ?? r.categoryId));
      if (!cat || cat.kind !== 'debit') return s;
      return s + Math.max(0, -r.amount);
    }, 0);
    const monthlyPonctual = [];
    if (history.length > 0) {
      for (let i = 1; i <= 6; i++) {
        const m = today.subtract(i, 'month');
        const ms = m.startOf('month');
        const me = m.endOf('month');
        let monthDebit = 0;
        for (const o of history) {
          if (o.amount >= 0) continue;
          if (!o.categoryId) continue;
          const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
          if (!cat || cat.kind !== 'debit') continue;
          const d = dayjs(o.date);
          if (d.isBefore(ms) || d.isAfter(me)) continue;
          monthDebit += -o.amount;
        }
        const ponctual = Math.max(0, monthDebit - recurringDebitTotal);
        monthlyPonctual.push(ponctual);
      }
    }
    const validPonctual = monthlyPonctual.filter((v) => v > 0);
    const avgPonctual = validPonctual.length > 0
      ? validPonctual.reduce((s, v) => s + v, 0) / validPonctual.length
      : 0;
    if (avgPonctual > 0) {
      // Ponctuel déjà engagé sur le mois sélectionné
      let monthDebitSelected = 0;
      for (const o of operations) {
        if (o.amount >= 0) continue;
        if (!o.categoryId) continue;
        const cat = catById.get(String(o.categoryId?._id ?? o.categoryId));
        if (!cat || cat.kind !== 'debit') continue;
        monthDebitSelected += -o.amount;
      }
      const currentPonctual = Math.max(0, monthDebitSelected - recurringDebitTotal);

      // a. Au-dessus de la moyenne (proportionnellement au % du mois écoulé
      //    si on regarde le mois en cours, sinon comparaison brute fin de
      //    mois).
      const totalDays = end.diff(start, 'day') + 1;
      const elapsed = isCurrent
        ? Math.max(1, today.diff(start, 'day') + 1)
        : totalDays;
      const expectedAtThisPoint = avgPonctual * (elapsed / totalDays);
      if (currentPonctual > expectedAtThisPoint * 1.2 && currentPonctual - expectedAtThisPoint > 50) {
        const overPct = ((currentPonctual / expectedAtThisPoint) - 1) * 100;
        items.push({
          severity: 'warning',
          icon: TrendingUp,
          title: 'Ponctuel au-dessus de votre moyenne',
          message: isCurrent
            ? `${formatEur(currentPonctual)} de ponctuel au jour ${elapsed}/${totalDays} vs ~${formatEur(expectedAtThisPoint)} attendu (+${overPct.toFixed(0)}%). Moyenne 6 mois : ${formatEur(avgPonctual)}/mois.`
            : `${formatEur(currentPonctual)} de ponctuel sur le mois vs ~${formatEur(avgPonctual)} en moyenne sur les 6 derniers mois (+${overPct.toFixed(0)}%).`,
        });
      }

      // b. Marge restante < ponctuel attendu d'ici la fin du mois (mois en
      //    cours uniquement). "Reste" = solde courant − récurrentes débit
      //    à venir d'ici la fin du mois.
      if (isCurrent && banks.length > 0) {
        const totalCurrent = banks.reduce((s, b) => s + (b.currentBalance || 0), 0);
        const dayToday = today.date();
        let remainingRecurringDebit = 0;
        for (const r of recurring) {
          if (r.dayOfMonth <= dayToday) continue;
          if (!r.categoryId) continue;
          const cat = catById.get(String(r.categoryId?._id ?? r.categoryId));
          if (!cat || cat.kind !== 'debit') continue;
          remainingRecurringDebit += Math.max(0, -r.amount);
        }
        const safeCash = totalCurrent - remainingRecurringDebit;
        const expectedRemainingPonctual = Math.max(0, avgPonctual - currentPonctual);
        if (expectedRemainingPonctual > 50 && safeCash < expectedRemainingPonctual) {
          items.push({
            severity: 'warning',
            icon: AlertTriangle,
            title: 'Marge serrée pour vos ponctuelles habituelles',
            message: `Reste ${formatEur(safeCash)} après récurrentes à venir, or vous dépensez en moyenne encore ${formatEur(expectedRemainingPonctual)} en ponctuel d'ici la fin du mois.`,
          });
        }
      }

      // c. Repère info systématique si rien d'autre n'est sorti côté ponctuel
      const alreadyMentioned = items.some((it) => /ponctuel/i.test(it.title));
      if (!alreadyMentioned) {
        items.push({
          severity: 'info',
          icon: Info,
          title: 'Moyenne ponctuelle (hors récurrentes)',
          message: `Vous dépensez en moyenne ${formatEur(avgPonctual)} de ponctuel par mois sur les 6 derniers. Ce mois : ${formatEur(currentPonctual)}.`,
        });
      }
    }

    // 8. Récurrentes attendues mais non détectées (mois en cours, après dayOfMonth)
    if (isCurrent && recurring.length > 0) {
      const dayToday = today.date();
      const sameLabel = (a, b) => {
        const al = (a || '').toLowerCase().trim();
        const bl = (b || '').toLowerCase().trim();
        if (!al || !bl) return false;
        return al.includes(bl) || bl.includes(al);
      };
      const missing = recurring.filter((r) => {
        if (r.dayOfMonth > dayToday) return false;
        if (r.categoryId) {
          const cat = catById.get(String(r.categoryId?._id ?? r.categoryId));
          if (cat && cat.kind === 'transfer') return false;
        }
        const rBank = String(r.bankId?._id ?? r.bankId);
        return !operations.some((o) => {
          const oBank = String(o.bankId?._id ?? o.bankId);
          if (oBank !== rBank) return false;
          return sameLabel(o.label, r.label);
        });
      });
      if (missing.length > 0) {
        const top = missing.slice(0, 3).map((r) => r.label).join(', ');
        items.push({
          severity: 'info',
          icon: AlertCircle,
          title: `${missing.length} récurrente${missing.length > 1 ? 's' : ''} non détectée${missing.length > 1 ? 's' : ''}`,
          message: `${top}${missing.length > 3 ? '…' : ''} attendue${missing.length > 1 ? 's' : ''} ce mois mais non identifiée${missing.length > 1 ? 's' : ''} dans les opérations.`,
        });
      }
    }

    items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    return items;
  }, [operations, comparisonOps, history, categories, recurring, banks, unpointed, monthOffset, startDate, endDate]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          Analyse du mois
          <InfoTip>
            Synthèse automatique des points marquants de la période :
            dépassements de budget, rythme de dépenses, anomalies (dépense
            atypique), comparaison vs mois précédent, signaux de qualité.
            Trié par criticité (rouge → orange → bleu → vert). Les
            signaux liés au temps réel (rythme, projection, récurrentes
            manquantes) ne sortent que sur le mois en cours.
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
          Rien à signaler — aucun point critique détecté sur la période.
        </p>
      ) : (
        <ul className="space-y-2">
          {insights.map((it, i) => <InsightItem key={i} {...it} />)}
        </ul>
      )}
    </div>
  );
}

function InsightItem({ severity, icon: Icon, title, message }) {
  const styles = {
    critical: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:text-rose-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300',
    info: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:border-indigo-400/30 dark:text-indigo-300',
    positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300',
  };
  return (
    <li className={cn('flex gap-2 rounded-md border p-2', styles[severity])}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs opacity-90">{message}</div>
      </div>
    </li>
  );
}

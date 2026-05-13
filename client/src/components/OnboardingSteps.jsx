import { Link } from 'react-router-dom';
import { Check, ArrowRight, Building2, ListOrdered, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OnboardingSteps({ banks, operations, categories, recurring }) {
  const hasBank = banks.length > 0;
  const hasOps = operations.length > 0 || recurring.length > 0;
  const hasBudget = categories.some((c) => Number(c.maxAmount) > 0);
  const allDone = hasBank && hasOps && hasBudget;
  if (allDone) return null;

  const steps = [
    { done: hasBank,   to: '/banks',      icon: Building2,   title: 'Ajoute ta première banque',        desc: 'Indique le solde affiché par ta banque pour démarrer le prévisionnel.' },
    { done: hasOps,    to: '/operations', icon: ListOrdered, title: 'Importe ou saisis tes opérations', desc: 'Charge un relevé CSV ou ajoute tes premières opérations à la main.' },
    { done: hasBudget, to: '/categories', icon: Tag,         title: 'Définis tes budgets',              desc: 'Fixe un plafond mensuel par catégorie pour suivre ta marge.' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Démarrage</h2>
          <p className="text-xs text-muted-foreground">{doneCount} sur {steps.length} étapes terminées</p>
        </div>
        <div className="flex h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => {
          const isNext = i === nextIdx;
          const Icon = s.icon;
          return (
            <li key={s.to}>
              <Link
                to={s.to}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  s.done && 'border-border/50 bg-muted/30 text-muted-foreground',
                  !s.done && isNext && 'border-primary/40 bg-primary/5 hover:bg-primary/10',
                  !s.done && !isNext && 'border-border hover:bg-muted/40',
                )}
              >
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  s.done ? 'bg-credit/15 text-credit' : isNext ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}>
                  {s.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-sm font-semibold', s.done && 'line-through decoration-1')}>{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
                {!s.done && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

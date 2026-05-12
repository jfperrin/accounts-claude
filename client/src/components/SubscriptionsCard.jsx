import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import dayjs from 'dayjs';
import CategoryBadge from '@/components/CategoryBadge';
import { formatEur, amountClass, cn } from '@/lib/utils';

function nextRenewal(dayOfMonth) {
  const today = dayjs();
  const target = today.date(Number(dayOfMonth));
  return target.isBefore(today, 'day') ? target.add(1, 'month') : target;
}

export default function SubscriptionsCard({ items, categories }) {
  const [open, setOpen] = useState(true);

  const subs = useMemo(
    () => items
      .filter((i) => Number(i.amount) < 0 && !i.toBankId)
      .map((i) => ({ ...i, next: nextRenewal(i.dayOfMonth) }))
      .sort((a, b) => a.next.valueOf() - b.next.valueOf()),
    [items],
  );

  if (subs.length === 0) return null;

  const totalMonthly = subs.reduce((s, i) => s + Math.abs(Number(i.amount)), 0);
  const totalYearly = totalMonthly * 12;

  return (
    <section className="rounded-xl border border-border bg-card shadow-xs">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          <Repeat className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Abonnements</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {subs.length} actif{subs.length > 1 ? 's' : ''}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <div className="text-right">
          <div className={cn('text-base font-bold tabular-nums', amountClass(-totalMonthly))}>
            {formatEur(-totalMonthly)} / mois
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            soit {formatEur(-totalYearly)} / an
          </div>
        </div>
      </header>

      {open && (
        <ul className="divide-y divide-border border-t border-border">
          {subs.map((s) => (
            <li key={s._id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-center">
                <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-bold tabular-nums leading-none mt-0.5">{s.dayOfMonth}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{s.label}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{s.bankId?.label}</span>
                  {s.categoryId && (
                    <>
                      <span aria-hidden>·</span>
                      <CategoryBadge categoryId={s.categoryId} categories={categories} />
                    </>
                  )}
                </div>
              </div>
              <div className={cn('shrink-0 text-sm font-semibold tabular-nums', amountClass(s.amount))}>
                {formatEur(s.amount)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

// `warning` and `success` are not in the theme; mapped to debit/credit variants.
const STYLE = {
  critical: { Icon: AlertCircle,   cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
  warning:  { Icon: AlertTriangle, cls: 'border-debit/40 bg-debit/10' },
  info:     { Icon: Info,          cls: 'border-border bg-card' },
  positive: { Icon: CheckCircle2,  cls: 'border-credit/40 bg-credit/10' },
};

export default function HighlightsList({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Points marquants</h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => {
          const { Icon, cls } = STYLE[h.severity] || STYLE.info;
          return (
            <li key={i} className={`flex gap-2 rounded-lg border p-2.5 text-sm ${cls}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{h.title}</div>
                <div className="text-foreground/90">{h.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

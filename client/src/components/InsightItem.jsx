import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const STYLES = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300',
  info: 'border-primary/30 bg-primary/10 text-primary',
  positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300',
};

export default function InsightItem({
  severity, icon: Icon, title, message, anchor,
}) {
  const body = (
    <>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs opacity-90">{message}</div>
      </div>
    </>
  );
  const base = cn('flex gap-2 rounded-md border p-2', STYLES[severity]);

  // `anchor` → la ligne devient un bouton qui fait défiler vers la section
  // ciblée (ex. le widget Budget). Sinon, simple élément de liste statique.
  if (anchor) {
    return (
      <li>
        <button
          type="button"
          aria-label={`${title}. Voir le détail.`}
          onClick={() =>
            document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={cn(
            base,
            'w-full cursor-pointer items-center text-left transition hover:brightness-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:brightness-110',
          )}
        >
          {body}
          <ChevronRight className="h-4 w-4 shrink-0 self-center opacity-60" />
        </button>
      </li>
    );
  }

  return <li className={base}>{body}</li>;
}

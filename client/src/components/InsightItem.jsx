import { cn } from '@/lib/utils';

const STYLES = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:border-rose-400/30 dark:text-rose-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300',
  info: 'border-primary/30 bg-primary/10 text-primary',
  positive: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-300',
};

export default function InsightItem({ severity, icon: Icon, title, message }) {
  return (
    <li className={cn('flex gap-2 rounded-md border p-2', STYLES[severity])}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs opacity-90">{message}</div>
      </div>
    </li>
  );
}

import { cn } from '@/lib/utils';

export default function DebitCreditToggle({ value, onChange, className, id }) {
  const base = 'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const inactive = 'text-muted-foreground hover:text-foreground';
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label="Sens du montant"
      className={cn('inline-flex w-full rounded-md border border-input bg-muted p-0.5', className)}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'debit'}
        onClick={() => onChange('debit')}
        className={cn(base, value === 'debit' ? 'bg-card text-debit shadow-sm' : inactive)}
      >
        Débit
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'credit'}
        onClick={() => onChange('credit')}
        className={cn(base, value === 'credit' ? 'bg-card text-credit shadow-sm' : inactive)}
      >
        Crédit
      </button>
    </div>
  );
}

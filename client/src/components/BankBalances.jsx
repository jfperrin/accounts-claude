import { memo, useState, useEffect } from 'react';
import { Building2, Pencil, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn, formatEur } from '@/lib/utils';

// BankCard affiche pour une banque :
//   - Solde actuel (currentBalance)         → éditable via inline input
//   - Solde projeté (projectedBalance)      → calculé serveur, lecture seule
//
// Les deux valeurs viennent enrichies depuis GET /api/banks (côté serveur).
const BankCard = memo(function BankCard({ bank, onSaveBalance }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bank.currentBalance ?? 0);
  useEffect(() => { setDraft(bank.currentBalance ?? 0); }, [bank.currentBalance]);

  const handleSave = () => {
    setEditing(false);
    const val = parseFloat(draft) || 0;
    if (val !== bank.currentBalance) onSaveBalance?.(bank._id, val);
  };

  const projected = bank.projectedBalance ?? 0;

  return (
    <div
      data-testid={`bank-card-${bank._id}`}
      className="rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 className="h-4 w-4 text-indigo-600" />
        {bank.label}
      </div>
      <Separator className="my-3" />

      <div className="mb-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Solde actuel</p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="number"
                autoFocus
                role="spinbutton"
                step="0.01"
                value={draft ?? ''}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button type="button" onClick={handleSave} className="text-emerald-600 hover:text-emerald-700">
                <Check className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-foreground">{formatEur(bank.currentBalance ?? 0)}</span>
              <button
                type="button"
                aria-label="modifier"
                onClick={() => { setDraft(bank.currentBalance ?? 0); setEditing(true); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévisionnel</p>
        <span className={cn('text-2xl font-bold', projected >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
          {formatEur(projected)}
        </span>
      </div>
    </div>
  );
});

export default function BankBalances({ banks, onSaveBalance }) {
  // Total prévisionnel toutes banques confondues — somme des projectedBalance.
  const totalProjected = banks.reduce((s, b) => s + (b.projectedBalance ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {banks.map((bank) => (
        <BankCard key={bank._id} bank={bank} onSaveBalance={onSaveBalance} />
      ))}
      {banks.length > 1 && (
        <div
          data-testid="total-card"
          className="hidden md:block rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 shadow-lg shadow-indigo-500/30"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">Total prévisionnel</p>
          <span className="text-2xl font-extrabold text-white">{formatEur(totalProjected)}</span>
        </div>
      )}
    </div>
  );
}

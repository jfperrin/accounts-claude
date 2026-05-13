import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { getTransferCandidates, linkTransfer } from '@/api/operations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatEur } from '@/lib/utils';

// Bandeau qui liste les paires d'opérations candidates à un virement
// interbanque (détection serveur, confirmation utilisateur).
// `reloadKey` permet à un parent (HomePage) de re-scanner après import ou
// après un changement majeur (création/suppression d'opérations).
export default function TransferCandidatesCard({ reloadKey = 0, onLinked }) {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getTransferCandidates();
      setPairs(data);
    } catch (err) {
      // Silencieux : la détection est un bonus, pas un flow critique.
      console.warn('Détection virements échouée', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reloadKey]);

  if (loading || pairs.length === 0) return null;

  const pairKey = (p) => `${p.outOp._id}__${p.inOp._id}`;
  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === pairs.length) setSelected(new Set());
    else setSelected(new Set(pairs.map(pairKey)));
  };

  const confirm = async () => {
    const toLink = pairs.filter((p) => selected.has(pairKey(p)));
    if (toLink.length === 0) return;
    setSubmitting(true);
    let ok = 0; let ko = 0;
    for (const p of toLink) {
      try {
        await linkTransfer(p.outOp._id, p.inOp._id);
        ok += 1;
      } catch {
        ko += 1;
      }
    }
    setSubmitting(false);
    if (ok) toast.success(`${ok} virement${ok > 1 ? 's' : ''} lié${ok > 1 ? 's' : ''}`);
    if (ko) toast.error(`${ko} échec${ko > 1 ? 's' : ''} de liaison`);
    setSelected(new Set());
    await load();
    onLinked?.();
  };

  return (
    <section className="rounded-xl border border-primary/40 bg-primary/5 shadow-xs">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex items-center gap-2 text-left"
        >
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">
            Virements interbanques détectés
          </h2>
          <Badge variant="secondary">{pairs.length}</Badge>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {expanded && pairs.length > 0 && (
          <button type="button" onClick={toggleAll} className="text-xs text-primary hover:underline">
            {selected.size === pairs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        )}
      </header>

      {expanded && (
        <>
          <p className="px-4 pb-2 text-xs text-muted-foreground">
            Paires d'opérations dont les montants sont opposés au centime
            près, sur des banques différentes, à 5 jours près. Coche les
            paires à marquer comme virements internes : elles ne seront
            plus comptées comme dépenses/revenus dans tes analyses.
          </p>
          <ul className="divide-y divide-border border-t border-border">
            {pairs.map((p) => {
              const key = pairKey(p);
              const checked = selected.has(key);
              return (
                <li key={key} className={cn('flex items-center gap-3 px-4 py-2.5', checked && 'bg-primary/5')}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    aria-label={`Sélectionner la paire ${p.outOp.label} / ${p.inOp.label}`}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
                  />
                  <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                    <Leg op={p.outOp} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                    <Leg op={p.inOp} />
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {Math.round(p.confidence * 100)}%
                  </div>
                </li>
              );
            })}
          </ul>
          <footer className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0 || submitting}
            >
              <X className="h-3.5 w-3.5" /> Effacer
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirm}
              disabled={selected.size === 0 || submitting}
            >
              <Check className="h-3.5 w-3.5" />
              Lier {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </footer>
        </>
      )}
    </section>
  );
}

function Leg({ op }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="shrink-0">{op.bankId?.label}</Badge>
        <span className={cn('shrink-0 tabular-nums text-xs font-semibold', op.amount < 0 ? 'text-debit' : 'text-credit')}>
          {formatEur(op.amount)}
        </span>
      </div>
      <div className="truncate text-xs text-muted-foreground" title={op.label}>
        {dayjs(op.date).format('DD/MM')} · {op.label}
      </div>
    </div>
  );
}

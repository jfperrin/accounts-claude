import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Home, ListChecks, Wallet, Repeat, Tag, Settings, HelpCircle,
  User as UserIcon, Plus, Search,
} from 'lucide-react';
import dayjs from 'dayjs';
import { list as listOperations } from '@/api/operations';
import { cn, formatEur, amountClass } from '@/lib/utils';

// Palette de commandes Cmd/Ctrl + K.
// Trois sections :
//   - Actions : "Créer une opération" (navigue vers /operations?new=1, lu par OperationsPage)
//   - Navigation : routes principales
//   - Opérations : recherche server-side debounced quand l'utilisateur tape ≥ 2 chars
//
// Le filtrage interne de cmdk est désactivé dès que la recherche est active
// (`shouldFilter={false}`) — les résultats viennent du serveur et ne doivent pas
// être re-filtrés côté client.

const ROUTES = [
  { label: 'Aller à l\'accueil', path: '/', icon: Home },
  { label: 'Aller aux opérations', path: '/operations', icon: ListChecks },
  { label: 'Aller aux banques', path: '/banks', icon: Wallet },
  { label: 'Aller aux opérations récurrentes', path: '/recurring', icon: Repeat },
  { label: 'Aller aux catégories', path: '/categories', icon: Tag },
  { label: 'Aller au profil', path: '/profile', icon: UserIcon },
  { label: 'Aller aux réglages', path: '/settings', icon: Settings },
  { label: 'Aller à l\'aide', path: '/help', icon: HelpCircle },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const startDate = dayjs().subtract(90, 'day').format('YYYY-MM-DD');
        const endDate = dayjs().add(1, 'year').format('YYYY-MM-DD');
        const data = await listOperations({ startDate, endDate, q });
        setResults(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [search]);

  const run = (fn) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  const hasQuery = search.trim().length >= 2;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[18%] z-50 w-[92vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xs outline-none"
        >
          <Dialog.Title className="sr-only">Palette de commandes</Dialog.Title>
          <Command label="Palette de commandes" shouldFilter={!hasQuery}>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Rechercher une opération ou tapez une commande…"
          className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
          {hasQuery && searching ? 'Recherche…' : 'Aucun résultat.'}
        </Command.Empty>

        {!hasQuery && (
          <>
            <Command.Group heading="Actions" className="text-xs uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              <CommandRow
                onSelect={() => run(() => navigate('/operations?new=1'))}
                icon={Plus}
                label="Créer une opération"
              />
            </Command.Group>
            <Command.Group heading="Navigation" className="text-xs uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {ROUTES.map((r) => (
                <CommandRow
                  key={r.path}
                  onSelect={() => run(() => navigate(r.path))}
                  icon={r.icon}
                  label={r.label}
                />
              ))}
            </Command.Group>
          </>
        )}

        {hasQuery && results.length > 0 && (
          <Command.Group heading="Opérations" className="text-xs uppercase tracking-wide text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
            {results.map((op) => (
              <Command.Item
                key={op._id}
                value={`op-${op._id}-${op.label}`}
                onSelect={() => run(() => navigate('/operations'))}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-muted aria-selected:text-foreground"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{op.label}</span>
                <span className={cn('shrink-0 tabular-nums text-xs font-medium', amountClass(op.amount))}>
                  {formatEur(op.amount)}
                </span>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {dayjs(op.date).format('DD/MM/YY')}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span><kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">↑</kbd> <kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">↓</kbd> naviguer</span>
        <span><kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">↵</kbd> valider</span>
        <span><kbd className="rounded border border-border bg-card px-1 py-0.5 font-sans">Esc</kbd> fermer</span>
      </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CommandRow({ onSelect, icon: Icon, label }) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-muted aria-selected:text-foreground"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span>{label}</span>
    </Command.Item>
  );
}

import { useEffect, useRef } from 'react';
import { Search, Tag, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import CategorySelectItems from '@/components/CategorySelectItems';

// Conteneur principal. Search en flex-1 (premier enfant) + un FilterRow qui
// wrap les contrôles. Mobile : empile en colonne ; >= sm : ligne.
//
// Sticky en haut de la fenêtre de scroll : reste visible quand l'utilisateur
// fait défiler la liste. Expose sa hauteur courante dans `--filter-bar-h` sur
// <html> pour que les en-têtes de table sticky puissent se stacker en-dessous
// (cf. OperationsTimeline). Sans FilterBar dans le DOM, la variable n'est pas
// définie et `top-[var(--filter-bar-h,0px)]` retombe sur 0.
export function FilterBar({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const update = () => {
      document.documentElement.style.setProperty('--filter-bar-h', `${node.offsetHeight}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--filter-bar-h');
    };
  }, []);
  return (
    <div
      ref={ref}
      className="sticky top-0 z-20 flex flex-col gap-2 bg-background py-2 sm:flex-row sm:items-center"
    >
      {children}
    </div>
  );
}

// Ligne de boutons/Selects à droite de la recherche. Wrap si manque de place.
export function FilterRow({ children }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

const DEFAULT_PLACEHOLDER = 'Rechercher : libellé et/ou montant (ex. free 1,99)…';

// Champ de recherche contrôlé (la page tient la valeur via useDebouncedSearch
// pour pouvoir la vider depuis un clearFilters() externe).
export function FilterSearchInput({
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  ariaLabel = 'Rechercher',
}) {
  return (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9"
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// Bouton toggle « Sans catégorie » avec compteur. Le `count` est calculé par
// la page (la définition d'« uncategorized » peut différer : Operations inclut
// tout `!categoryId`, Recurring exclut les virements internes).
export function FilterUncategorizedToggle({
  value,
  onChange,
  count = 0,
  label = 'Sans catégorie',
  title = 'Afficher uniquement les éléments sans catégorie',
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        value
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      }`}
      title={title}
    >
      <Tag className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
          value ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

// Select catégorie standard : « all » | « none » | <id>.
export function FilterCategorySelect({ value, onChange, categories }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40" aria-label="Filtrer par catégorie"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes catégories</SelectItem>
        <SelectItem value="none">Sans catégorie</SelectItem>
        <CategorySelectItems categories={categories} />
      </SelectContent>
    </Select>
  );
}

// Select banque : ne se rend que s'il y a au moins 2 banques (sinon le filtre
// n'a aucun pouvoir discriminant).
export function FilterBankSelect({ value, onChange, banks }) {
  if (!banks || banks.length < 2) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40" aria-label="Filtrer par banque"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes banques</SelectItem>
        {banks.map((b) => (
          <SelectItem key={b._id} value={String(b._id)}>{b.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Bouton de réinitialisation : null tant qu'aucun filtre n'est actif.
export function FilterReset({ active, onClick, label = 'Réinitialiser' }) {
  if (!active) return null;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} className="text-muted-foreground">
      {label}
    </Button>
  );
}

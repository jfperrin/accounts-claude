import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Download, Sparkles, ArrowUp, ArrowDown, ArrowUpDown, RefreshCw, ArrowLeftRight, ArrowRight, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  list as listRecurring,
  create as createRecurring,
  update as updateRecurring,
  remove as removeRecurring,
  getSuggestions,
} from '@/api/recurringOperations';
import { list as listBanks } from '@/api/banks';
import {
  generateRecurring,
  findSimilarUncategorized,
  bulkCategorize,
} from '@/api/operations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn, formatEur, amountClass } from '@/lib/utils';
import DebitCreditToggle from '@/components/DebitCreditToggle';
import CategoryBadge from '@/components/CategoryBadge';
import CategorySelectItems from '@/components/CategorySelectItems';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import RecurringSuggestions from '@/components/RecurringSuggestions';
import BulkCategorizeDialog from '@/components/BulkCategorizeDialog';
import GenerateRecurringDialog from '@/components/GenerateRecurringDialog';
import EmptyState from '@/components/EmptyState';
import TableSkeleton from '@/components/TableSkeleton';
import { useCategories } from '@/hooks/useCategories';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const empty = () => ({ label: '', bankId: '', dayOfMonth: '', amount: '', kind: 'debit', categoryId: 'none', isTransfer: false, toBankId: '' });

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { item? }
  const [form, setForm] = useState(empty());
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Boîte de dialogue de génération : checklist mois/année + sélection des récurrentes.
  const [genOpen, setGenOpen] = useState(false);
  // Suggestions de récurrentes : null tant que pas scanné, [] = aucune, [...] = liste.
  const [suggestions, setSuggestions] = useState(null);
  const [detecting, setDetecting] = useState(false);
  // Modale de catégorisation en lot des opérations existantes après création
  // d'une récurrente catégorisée. { categoryId, candidates }.
  const [bulkCat, setBulkCat] = useState(null);

  // silent : pas de toast (auto-détection au montage). Sinon, feedback visible.
  const runDetection = async ({ silent = false } = {}) => {
    setDetecting(true);
    try {
      const data = await getSuggestions();
      setSuggestions(data);
      if (!silent) {
        toast.success(
          data.length === 0
            ? 'Aucune récurrente détectée'
            : `${data.length} suggestion${data.length > 1 ? 's' : ''} détectée${data.length > 1 ? 's' : ''}`,
        );
      }
    } catch (err) {
      if (!silent) toast.error(err.message || 'Erreur lors de la détection');
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => { runDetection({ silent: true }); }, []);

  const { categories } = useCategories();
  const load = () => {
    setLoading(true);
    return Promise.all([listRecurring(), listBanks()])
      .then(([ops, b]) => { setItems(ops); setBanks(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput.trim().toLowerCase()), 200);
    return () => clearTimeout(id);
  }, [searchInput]);

  const [filterCategory, setFilterCategory] = useState('all'); // 'all' | 'none' | <id>
  const [filterType, setFilterType] = useState('all'); // 'all' | 'subscription' | 'income' | 'transfer'
  const filtersActive = q || filterCategory !== 'all' || filterType !== 'all';
  const clearFilters = () => {
    setSearchInput(''); setQ(''); setFilterCategory('all'); setFilterType('all');
  };

  const [sortKey, setSortKey] = useState('dayOfMonth');
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'amount' || key === 'dayOfMonth' ? 'asc' : 'asc');
    }
  };
  const sortIcon = (k) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const sortedItems = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmpStr = (a, b) => (a ?? '').localeCompare(b ?? '', 'fr', { sensitivity: 'base' });
    const catLabel = (id) => categories.find((c) => c._id === id)?.label ?? '';
    // Recherche : sur le libellé uniquement. Insensible à la casse, sans
    // accent (NFD + suppression des marques) pour matcher « epargne » contre
    // « Épargne ». Le filtre catégorie est un Select indépendant.
    const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '');
    const needle = norm(q);
    // Type d'une récurrente :
    //   - 'transfer'     : possède une banque destination (virement interne)
    //   - 'income'       : montant positif sans destination (revenu mensuel)
    //   - 'subscription' : montant négatif sans destination (abonnement / dépense récurrente)
    const typeOf = (item) => {
      if (item.toBankId) return 'transfer';
      return Number(item.amount) >= 0 ? 'income' : 'subscription';
    };
    const matches = (item) => {
      if (needle && !norm(item.label).includes(needle)) return false;
      if (filterCategory === 'none' && item.categoryId) return false;
      if (filterCategory !== 'all' && filterCategory !== 'none' && String(item.categoryId) !== filterCategory) return false;
      return filterType === 'all' || typeOf(item) === filterType;
    };
    const arr = items.filter(matches);
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'label': return cmpStr(a.label, b.label) * dir;
        case 'bank': return cmpStr(a.bankId?.label, b.bankId?.label) * dir;
        case 'category': return cmpStr(catLabel(a.categoryId), catLabel(b.categoryId)) * dir;
        case 'amount': return (a.amount - b.amount) * dir;
        case 'dayOfMonth':
        default: return (Number(a.dayOfMonth) - Number(b.dayOfMonth)) * dir;
      }
    });
    return arr;
  }, [items, sortKey, sortDir, categories, q, filterCategory, filterType]);

  const sortedSum = useMemo(
    () => sortedItems.reduce((s, i) => s + Number(i.amount || 0), 0),
    [sortedItems],
  );

  const openAdd = () => { setForm(empty()); setModal({}); };
  const openFromSuggestion = (s) => {
    setForm({
      label: s.label,
      bankId: s.bankId,
      dayOfMonth: String(s.dayOfMonth),
      amount: String(Math.abs(s.amount)),
      kind: s.amount < 0 ? 'debit' : 'credit',
      categoryId: s.categoryId ?? 'none',
      isTransfer: false,
      toBankId: '',
    });
    setModal({});
  };
  const openEdit = (item) => {
    const isTransfer = !!item.toBankId;
    setForm({
      label: item.label,
      bankId: item.bankId?._id ?? item.bankId ?? '',
      dayOfMonth: String(item.dayOfMonth),
      amount: String(Math.abs(item.amount)),
      kind: isTransfer ? 'debit' : (item.amount < 0 ? 'debit' : 'credit'),
      categoryId: isTransfer ? 'none' : (item.categoryId ?? 'none'),
      isTransfer,
      toBankId: item.toBankId ?? '',
    });
    setModal({ item });
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val?.target?.value ?? val }));

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const abs = Math.abs(parseFloat(form.amount));
      let payload;
      if (form.isTransfer) {
        if (!form.bankId || !form.toBankId) { toast.error('Banques source et destination requises'); return; }
        if (String(form.bankId) === String(form.toBankId)) { toast.error('Source et destination doivent différer'); return; }
        payload = {
          label: form.label,
          bankId: form.bankId,
          toBankId: form.toBankId,
          dayOfMonth: Number(form.dayOfMonth),
          amount: abs,
          categoryId: null,
        };
      } else {
        payload = {
          label: form.label,
          bankId: form.bankId,
          dayOfMonth: Number(form.dayOfMonth),
          amount: form.kind === 'debit' ? -abs : abs,
          categoryId: (form.categoryId && form.categoryId !== 'none') ? form.categoryId : null,
          toBankId: null,
        };
      }
      const isCreate = !modal.item;
      isCreate ? await createRecurring(payload) : await updateRecurring(modal.item._id, payload);
      toast.success('Enregistré');
      setModal(null);
      load();
      // Si on créait depuis une suggestion, on la retire de la liste.
      if (isCreate && suggestions) {
        setSuggestions((prev) => prev.filter((s) => s.label !== payload.label || String(s.bankId) !== String(payload.bankId)));
      }
      // À la création d'une récurrente catégorisée : propose de catégoriser
      // les opérations existantes au libellé similaire dans la même banque.
      if (isCreate && payload.categoryId && payload.bankId) {
        try {
          const candidates = await findSimilarUncategorized({
            label: payload.label,
            bankId: payload.bankId,
          });
          if (candidates.length > 0) setBulkCat({ categoryId: payload.categoryId, candidates });
        } catch {
          /* silencieux : la récurrente est déjà enregistrée */
        }
      }
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleBulkConfirm = async (ids) => {
    if (ids.length === 0) { setBulkCat(null); return; }
    try {
      const { updated } = await bulkCategorize(ids, bulkCat.categoryId);
      toast.success(`${updated} opération${updated > 1 ? 's' : ''} catégorisée${updated > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setBulkCat(null);
    }
  };

  const onCategoryChange = async (id, categoryId) => {
    try {
      await updateRecurring(id, { categoryId });
      load();
      if (!categoryId) return;
      const item = items.find((i) => i._id === id);
      const bankId = item?.bankId?._id ?? item?.bankId;
      if (!item || !bankId) return;
      try {
        const candidates = await findSimilarUncategorized({ label: item.label, bankId });
        if (candidates.length > 0) setBulkCat({ categoryId, candidates });
      } catch {
        /* silencieux : la récurrente est déjà catégorisée */
      }
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    try {
      await removeRecurring(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const onGenerate = async ({ month, year, recurringIds }) => {
    try {
      const { imported } = await generateRecurring({ month, year, recurringIds });
      toast.success(`${imported} opération(s) générée(s) pour ${MONTHS[month - 1]} ${year}`);
      setGenOpen(false);
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la génération');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-foreground">Opérations récurrentes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runDetection()} disabled={detecting} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Détecter
          </Button>
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2">
            <Download className="h-4 w-4" />
            Générer pour un mois
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      <RecurringSuggestions
        suggestions={suggestions}
        loading={detecting}
        categories={categories}
        onCreate={openFromSuggestion}
        onChange={setSuggestions}
      />

      {loading && items.length === 0 ? (
        <TableSkeleton rows={5} cols={['w-40', 'w-28', 'w-16', 'w-20', 'w-24']} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={RefreshCw}
          title="Aucune opération récurrente"
          description="Les récurrentes (loyer, salaire, abonnements) sont rejouées chaque mois pour anticiper le prévisionnel. Clique sur Détecter pour les retrouver dans ton historique, ou ajoute-les à la main."
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => runDetection()} disabled={detecting}>
                <Sparkles className="h-4 w-4" />
                {detecting ? 'Analyse…' : 'Détecter automatiquement'}
              </Button>
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Ajouter manuellement
              </Button>
            </>
          }
        />
      ) : (
      <div className="space-y-2">
        {items.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher dans le libellé…"
                className="pl-9 pr-9"
                aria-label="Rechercher dans les récurrentes"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-37.5" aria-label="Filtrer par type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="subscription">Abonnements</SelectItem>
                  <SelectItem value="income">Revenus</SelectItem>
                  <SelectItem value="transfer">Virements</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40" aria-label="Filtrer par catégorie"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="none">Sans catégorie</SelectItem>
                  <CategorySelectItems categories={categories} />
                </SelectContent>
              </Select>
              {filtersActive && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        )}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">
              {filterType === 'subscription' ? 'Abonnements'
                : filterType === 'income' ? 'Revenus récurrents'
                : filterType === 'transfer' ? 'Virements récurrents'
                : 'Toutes les récurrentes'}
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {sortedItems.length}
              {filtersActive && items.length !== sortedItems.length && (
                <> sur {items.length}</>
              )}
            </span>
          </div>
          {sortedItems.length > 0 && (
            <div className="text-right">
              <div className={cn('text-base font-bold tabular-nums', amountClass(sortedSum))}>
                {sortedSum > 0 ? '+' : ''}{formatEur(sortedSum)}
                <span className="ml-1 text-xs font-medium text-muted-foreground">/ mois</span>
              </div>
              {filterType === 'subscription' && (
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  soit {formatEur(sortedSum * 12)} / an
                </div>
              )}
            </div>
          )}
        </header>
        {filtersActive && sortedItems.length === 0 && (
          <div className="border-t border-border p-6 text-center text-sm text-muted-foreground">
            Aucune récurrente ne correspond aux filtres.{' '}
            <button type="button" onClick={clearFilters} className="text-primary hover:underline">
              Réinitialiser
            </button>
          </div>
        )}
        {sortedItems.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button type="button" onClick={() => toggleSort('label')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Libellé {sortIcon('label')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => toggleSort('bank')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Banque {sortIcon('bank')}
                </button>
              </TableHead>
              <TableHead>
                <button type="button" onClick={() => toggleSort('category')} className="inline-flex items-center gap-1 hover:text-foreground">
                  Catégorie {sortIcon('category')}
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" onClick={() => toggleSort('dayOfMonth')} className="inline-flex items-center gap-1 hover:text-foreground mx-auto">
                  Jour {sortIcon('dayOfMonth')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-foreground ml-auto">
                  Montant {sortIcon('amount')}
                </button>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map((item) => {
              const toBank = item.toBankId ? banks.find((b) => String(b._id) === String(item.toBankId)) : null;
              return (
              <TableRow key={item._id}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {item.toBankId && (
                      <span title="Virement interne récurrent" className="shrink-0">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                      </span>
                    )}
                    {item.label || (item.toBankId ? `Virement → ${toBank?.label ?? '…'}` : '')}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.bankId?.label}</Badge>
                  {item.toBankId && toBank && (
                    <>
                      <ArrowRight className="inline mx-1 h-3 w-3 text-muted-foreground" aria-hidden />
                      <Badge variant="secondary">{toBank.label}</Badge>
                    </>
                  )}
                </TableCell>
                <TableCell>
                  {item.toBankId ? (
                    <span className="text-xs text-muted-foreground italic">virement</span>
                  ) : item.categoryId ? (
                    <CategoryBadge
                      categoryId={item.categoryId}
                      categories={categories}
                      onRemove={() => onCategoryChange(item._id, null)}
                    />
                  ) : (
                    <Select
                      value="none"
                      onValueChange={(v) => onCategoryChange(item._id, v === 'none' ? null : v)}
                    >
                      <SelectTrigger className="h-6 w-36 border-dashed text-xs text-muted-foreground">
                        <SelectValue placeholder="Catégorie…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Sans catégorie</SelectItem>
                        <CategorySelectItems categories={categories} />
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">{item.dayOfMonth}</TableCell>
                <TableCell className={cn('text-right font-semibold', amountClass(item.amount))}>
                  {item.amount > 0 ? '+' : ''}{formatEur(item.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="supprimer"
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(item._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>
      </div>
      )}

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.item ? 'Modifier' : 'Nouvelle opération récurrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="inline-flex w-full rounded-md border border-input bg-muted p-0.5" role="radiogroup" aria-label="Type de récurrente">
              <button
                type="button"
                role="radio"
                aria-checked={!form.isTransfer}
                onClick={() => setForm((f) => ({ ...f, isTransfer: false, toBankId: '' }))}
                className={cn('flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors', !form.isTransfer ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                Opération
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.isTransfer}
                onClick={() => setForm((f) => ({ ...f, isTransfer: true, kind: 'debit', categoryId: 'none' }))}
                className={cn('flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5', form.isTransfer ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> Virement
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rec-label">Libellé{form.isTransfer && <span className="text-muted-foreground"> (optionnel)</span>}</Label>
              <Input id="rec-label" autoFocus value={form.label} onChange={set('label')} placeholder={form.isTransfer ? 'Virement automatique selon les banques' : undefined} required={!form.isTransfer} />
            </div>

            {form.isTransfer ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <div className="space-y-1.5">
                  <Label>De</Label>
                  <Select value={form.bankId} onValueChange={set('bankId')}>
                    <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <ArrowRight className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="space-y-1.5">
                  <Label>Vers</Label>
                  <Select value={form.toBankId} onValueChange={set('toBankId')}>
                    <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                    <SelectContent>
                      {banks.filter((b) => String(b._id) !== String(form.bankId)).map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Banque</Label>
                <Select value={form.bankId} onValueChange={set('bankId')}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Jour du mois</Label>
              <Select value={form.dayOfMonth} onValueChange={set('dayOfMonth')}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-amount">Montant (€)</Label>
              <div className="flex gap-2">
                {!form.isTransfer && (
                  <DebitCreditToggle
                    value={form.kind}
                    onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                    className="w-auto shrink-0"
                  />
                )}
                <Input id="rec-amount" type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
            {!form.isTransfer && (
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sans catégorie</SelectItem>
                    <CategorySelectItems categories={categories} />
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer ?"
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <BulkCategorizeDialog
        open={!!bulkCat}
        candidates={bulkCat?.candidates ?? []}
        categoryId={bulkCat?.categoryId}
        categories={categories}
        onConfirm={handleBulkConfirm}
        onCancel={() => setBulkCat(null)}
      />

      <GenerateRecurringDialog
        open={genOpen}
        recurring={items}
        onConfirm={onGenerate}
        onCancel={() => setGenOpen(false)}
      />
    </div>
  );
}

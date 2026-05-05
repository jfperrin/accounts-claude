import { useState, useMemo, Fragment } from 'react';
import {
  Plus, Pencil, Trash2, Tag, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { create, update, remove } from '@/api/categories';
import { useCategories } from '@/hooks/useCategories';
import { useRecurringOperations } from '@/hooks/useRecurringOperations';
import { CATEGORY_COLORS, DEFAULT_COLOR } from '@/lib/categoryColors';
import { sortCategoriesByHierarchy } from '@/lib/categoryHierarchy';
import { cn, formatEur } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import CategoryColorPicker from '@/components/CategoryColorPicker';

export default function CategoriesPage() {
  const { categories, reload } = useCategories();
  const { recurring } = useRecurringOperations();

  const [modal, setModal] = useState(null); // null | { cat? }
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [maxAmount, setMaxAmount] = useState('');
  const [kind, setKind] = useState('debit');
  const [parentId, setParentId] = useState('none');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAdd = () => {
    setLabel(''); setColor(DEFAULT_COLOR); setMaxAmount(''); setKind('debit'); setParentId('none');
    setModal({});
  };
  const openEdit = (cat) => {
    setLabel(cat.label);
    setColor(cat.color ?? DEFAULT_COLOR);
    setMaxAmount(cat.maxAmount != null ? String(cat.maxAmount) : '');
    setKind(cat.kind ?? 'debit');
    setParentId(cat.parentId ?? 'none');
    setModal({ cat });
  };

  // Une catégorie qui a déjà des enfants ne peut pas devenir elle-même enfant
  // (limite à 1 niveau). On détecte ça côté UI pour désactiver le select Parent.
  const editingHasChildren = useMemo(() => {
    if (!modal?.cat) return false;
    return categories.some((c) => c.parentId === modal.cat._id);
  }, [modal, categories]);

  // Parents éligibles : racines du même kind, exclut la cat éditée elle-même.
  const eligibleParents = useMemo(() => {
    return categories
      .filter((c) => !c.parentId)
      .filter((c) => c.kind === kind)
      .filter((c) => !modal?.cat || c._id !== modal.cat._id);
  }, [categories, kind, modal]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    const payload = {
      label: label.trim(),
      color,
      kind,
      parentId: parentId === 'none' ? null : parentId,
      maxAmount: kind === 'transfer' || maxAmount.trim() === ''
        ? null
        : Number(maxAmount.replace(',', '.')),
    };
    if (payload.maxAmount !== null && (!Number.isFinite(payload.maxAmount) || payload.maxAmount < 0)) {
      toast.error('Montant max invalide');
      return;
    }
    try {
      if (modal.cat) {
        await update(modal.cat._id, payload);
      } else {
        await create(payload);
      }
      toast.success('Enregistré');
      setModal(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  const onDelete = async () => {
    try {
      await remove(deleteTarget);
      setDeleteTarget(null);
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const onColorChange = async (cat, newColor) => {
    try {
      await update(cat._id, {
        label: cat.label,
        color: newColor,
        maxAmount: cat.maxAmount,
        kind: cat.kind,
        parentId: cat.parentId ?? null,
      });
      reload();
    } catch (err) {
      toast.error(err.message || 'Erreur');
    }
  };

  // Récurrentes par catégorie (kind-aware) : somme des montants positifs pour
  // une catégorie credit, valeur absolue des négatifs pour une debit.
  const directional = (sum, kind) =>
    (kind === 'credit' ? Math.max(0, sum) : Math.max(0, -sum));

  const recurringByCategory = useMemo(() => {
    const m = new Map();
    for (const r of recurring) {
      if (!r.categoryId) continue;
      m.set(r.categoryId, (m.get(r.categoryId) ?? 0) + r.amount);
    }
    return m;
  }, [recurring]);

  // Liste des récurrentes triées par jour du mois, indexées par categoryId.
  const recurringListByCategory = useMemo(() => {
    const m = new Map();
    for (const r of recurring) {
      if (!r.categoryId) continue;
      if (!m.has(r.categoryId)) m.set(r.categoryId, []);
      m.get(r.categoryId).push(r);
    }
    for (const list of m.values()) list.sort((a, b) => a.dayOfMonth - b.dayOfMonth);
    return m;
  }, [recurring]);

  const [expandedId, setExpandedId] = useState(null);

  // Pour chaque catégorie : récurrentes + complément (maxAmount) + total.
  // C'est ce total qui sert de budget mensuel pour le chart.
  const budgets = useMemo(() => categories.map((c) => {
    const recurringAmount = directional(recurringByCategory.get(c._id) ?? 0, c.kind);
    const extra = c.maxAmount ?? 0;
    return { recurringAmount, extra, total: recurringAmount + extra };
  }), [categories, recurringByCategory]);

  // Lookup budget par categoryId — l'index par position du tableau ne suffit
  // plus dès qu'on rend dans l'ordre hiérarchique.
  const budgetById = useMemo(() => {
    const m = new Map();
    categories.forEach((c, i) => m.set(c._id, budgets[i]));
    return m;
  }, [categories, budgets]);

  const orderedRows = useMemo(() => sortCategoriesByHierarchy(categories), [categories]);

  // Chart : agrégat global des budgets définis (récurrentes + complément).
  // Deux barres empilées — Dépenses vs Revenus — chaque segment représentant
  // une catégorie. Les opérations réelles ne participent pas à ce graphe.
  const { chartData, chartCategories, totals } = useMemo(() => {
    const debitRow = { name: 'Dépenses' };
    const creditRow = { name: 'Revenus' };
    const used = [];
    let totalDebit = 0;
    let totalCredit = 0;
    categories.forEach((c, i) => {
      if (c.kind === 'transfer') return;
      const total = budgets[i].total;
      if (total <= 0) return;
      used.push({ label: c.label, color: c.color || DEFAULT_COLOR });
      if (c.kind === 'credit') {
        creditRow[c.label] = total;
        totalCredit += total;
      } else {
        debitRow[c.label] = total;
        totalDebit += total;
      }
    });
    return {
      chartData: [debitRow, creditRow],
      chartCategories: used,
      totals: { debit: totalDebit, credit: totalCredit, balance: totalCredit - totalDebit },
    };
  }, [categories, budgets]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-foreground">Catégories</h1>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Définissez un type (dépense ou revenu) et un budget mensuel : la somme des opérations récurrentes assignées à la catégorie est cumulée à un complément optionnel pour donner le total.
      </p>

      <div className="rounded-xl border border-border bg-card shadow-xs">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Tag className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">Aucune catégorie</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Libellé</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right hidden md:table-cell">Récurrentes</TableHead>
                <TableHead className="text-right hidden md:table-cell">Complément</TableHead>
                <TableHead className="text-right">Total / mois</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedRows.map(({ cat, depth }) => {
                const b = budgetById.get(cat._id) ?? { recurringAmount: 0, extra: 0, total: 0 };
                const ops = recurringListByCategory.get(cat._id) ?? [];
                const expandable = ops.length > 0;
                const isExpanded = expandable && expandedId === cat._id;
                return (
                  <Fragment key={cat._id}>
                    <TableRow>
                      <TableCell className="w-8">
                        {expandable ? (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : cat._id)}
                            aria-label={isExpanded ? 'Replier' : 'Déplier'}
                            aria-expanded={isExpanded}
                            className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                          >
                            <ChevronRight className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center gap-2 font-medium"
                          style={depth > 0 ? { paddingLeft: '1.25rem' } : undefined}
                        >
                          {depth > 0 && (
                            <span className="text-muted-foreground text-xs select-none">↳</span>
                          )}
                          <CategoryColorPicker
                            color={cat.color}
                            onChange={(c) => onColorChange(cat, c)}
                          />
                          {cat.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <KindBadge kind={cat.kind ?? 'debit'} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell text-muted-foreground">
                        {b.recurringAmount > 0 ? formatEur(b.recurringAmount) : <span>—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell text-muted-foreground">
                        {cat.maxAmount != null ? formatEur(cat.maxAmount) : <span>—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {b.total > 0 ? formatEur(b.total) : <span className="text-muted-foreground font-normal">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="éditer" onClick={() => openEdit(cat)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="supprimer"
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => setDeleteTarget(cat._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={7} className="p-0">
                          <RecurringList ops={ops} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <BudgetChart data={chartData} chartCategories={chartCategories} totals={totals} />

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal?.cat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="cat-label">Libellé</Label>
              <Input
                id="cat-label"
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <KindButton active={kind === 'debit'} onClick={() => setKind('debit')} kind="debit" />
                <KindButton active={kind === 'credit'} onClick={() => setKind('credit')} kind="credit" />
                <KindButton active={kind === 'transfer'} onClick={() => setKind('transfer')} kind="transfer" />
              </div>
              {kind === 'transfer' && (
                <p className="text-xs text-muted-foreground">
                  Les opérations de cette catégorie sont exclues des graphes et prévisions.
                </p>
              )}
            </div>

            {kind !== 'transfer' && (
              <BudgetField
                maxAmount={maxAmount}
                setMaxAmount={setMaxAmount}
                kind={kind}
                recurringSum={directional(recurringByCategory.get(label) ?? 0, kind)}
              />
            )}

            <div className="space-y-1.5">
              <Label>Catégorie parente (optionnelle)</Label>
              <Select
                value={parentId}
                onValueChange={setParentId}
                disabled={editingHasChildren}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Aucune (catégorie racine)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune (racine)</SelectItem>
                  {eligibleParents.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color ?? DEFAULT_COLOR }}
                        />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editingHasChildren && (
                <p className="text-xs text-muted-foreground">
                  Cette catégorie a des sous-catégories — elle ne peut pas devenir enfant.
                </p>
              )}
              {!editingHasChildren && eligibleParents.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune catégorie racine du même type disponible.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <div className="flex flex-wrap items-center gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{ backgroundColor: c, outline: color.toLowerCase() === c.toLowerCase() ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
                    aria-label={c}
                  />
                ))}
                <label
                  className="ml-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                  title="Couleur personnalisée"
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                  />
                  <span className="text-xs">+</span>
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteTarget}
        title="Supprimer la catégorie ?"
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function BudgetField({ maxAmount, setMaxAmount, kind, recurringSum }) {
  const extra = maxAmount.trim() === '' ? 0 : Number(maxAmount.replace(',', '.'));
  const total = recurringSum + (Number.isFinite(extra) && extra > 0 ? extra : 0);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="cat-max">Budget mensuel</Label>
      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Récurrentes</span>
          <span className="tabular-nums">{recurringSum > 0 ? formatEur(recurringSum) : '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="cat-max" className="flex-1 text-sm text-muted-foreground font-normal">
            Complément ({kind === 'credit' ? 'revenu' : 'dépense'})
          </Label>
          <Input
            id="cat-max"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="h-8 w-28 text-right tabular-nums"
          />
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm font-medium">
          <span>Total</span>
          <span className="tabular-nums">{total > 0 ? formatEur(total) : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function RecurringList({ ops }) {
  return (
    <ul className="divide-y divide-border/60 px-4 sm:px-12 py-2">
      {ops.map((r) => (
        <li key={r._id} className="flex items-center gap-3 py-1.5 text-sm">
          <span className="w-10 shrink-0 text-xs text-muted-foreground tabular-nums">
            j. {r.dayOfMonth}
          </span>
          <span className="flex-1 truncate">{r.label}</span>
          <span className="hidden sm:inline text-xs text-muted-foreground truncate">
            {r.bankId?.label}
          </span>
          <span className={cn(
            'tabular-nums font-medium',
            r.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
            {formatEur(r.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const KIND_META = {
  debit: {
    label: 'Dépense',
    Icon: ArrowDownCircle,
    badge: 'bg-rose-500 text-white dark:bg-rose-600',
    border: 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  },
  credit: {
    label: 'Revenu',
    Icon: ArrowUpCircle,
    badge: 'bg-emerald-500 text-white dark:bg-emerald-600',
    border: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  transfer: {
    label: 'Virement interne',
    shortLabel: 'Virement',
    Icon: ArrowLeftRight,
    badge: 'bg-muted text-muted-foreground border border-border',
    border: 'border-foreground/40 bg-muted text-foreground',
  },
};

function KindBadge({ kind }) {
  const meta = KIND_META[kind] ?? KIND_META.debit;
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full pl-2 pr-2.5 py-1 text-xs font-medium',
        meta.badge,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function KindButton({ active, onClick, kind }) {
  const meta = KIND_META[kind] ?? KIND_META.debit;
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
        active
          ? meta.border
          : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {meta.shortLabel ?? meta.label}
    </button>
  );
}

function BudgetChart({ data, chartCategories, totals }) {
  if (!chartCategories.length) return null;

  const balancePositive = totals.balance >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">Budget mensuel</h2>
        <p className="text-xs text-muted-foreground">Dépenses / Revenus</p>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          barCategoryGap="35%"
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(v) => formatEur(v)}
            stroke="var(--muted-foreground)"
            fontSize={11}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={80}
          />
          <Tooltip content={<BudgetTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
          {chartCategories.map((c, i) => (
            <Bar
              key={c.label}
              dataKey={c.label}
              stackId="a"
              fill={c.color}
              radius={
                i === 0
                  ? [4, 0, 0, 4]
                  : i === chartCategories.length - 1 ? [0, 4, 4, 0] : 0
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-sm">
        <SummaryCell label="Dépenses" value={totals.debit} tone="debit" />
        <SummaryCell label="Revenus" value={totals.credit} tone="credit" />
        <SummaryCell
          label="Solde"
          value={totals.balance}
          tone={balancePositive ? 'credit' : 'debit'}
          showSign
        />
      </div>
    </div>
  );
}

function SummaryCell({ label, value, tone, showSign }) {
  const text = showSign && value > 0 ? `+${formatEur(value)}` : formatEur(value);
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        'tabular-nums font-semibold',
        tone === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}>
        {text}
      </span>
    </div>
  );
}

function BudgetTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => p.value > 0);
  if (!items.length) return null;
  const total = items.reduce((s, p) => s + p.value, 0);
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
      <p className="font-semibold">{label}</p>
      {items.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.dataKey}</span>
          <span className="tabular-nums">{formatEur(p.value)}</span>
        </div>
      ))}
      <div className="flex justify-between border-t border-border/60 pt-1 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{formatEur(total)}</span>
      </div>
    </div>
  );
}

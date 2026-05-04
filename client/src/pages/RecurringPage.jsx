import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Download, Sparkles } from 'lucide-react';
import dayjs from 'dayjs';
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
import { cn, formatEur } from '@/lib/utils';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import CategoryBadge from '@/components/CategoryBadge';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import RecurringSuggestions from '@/components/RecurringSuggestions';
import BulkCategorizeDialog from '@/components/BulkCategorizeDialog';
import { useCategories } from '@/hooks/useCategories';

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);
const empty = () => ({ label: '', bankId: '', dayOfMonth: '', amount: '', categoryId: 'none' });

export default function RecurringPage() {
  const [items, setItems] = useState([]);
  const [banks, setBanks] = useState([]);
  const [modal, setModal] = useState(null); // null | { item? }
  const [form, setForm] = useState(empty());
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Boîte de dialogue de génération : on demande mois/année avant d'appeler le serveur.
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(dayjs().month() + 1);
  const [genYear, setGenYear] = useState(CURRENT_YEAR);
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
  const load = () => Promise.all([listRecurring(), listBanks()]).then(([ops, b]) => { setItems([...ops].sort((a, b) => a.dayOfMonth - b.dayOfMonth)); setBanks(b); });
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(empty()); setModal({}); };
  const openFromSuggestion = (s) => {
    setForm({
      label: s.label,
      bankId: s.bankId,
      dayOfMonth: String(s.dayOfMonth),
      amount: String(s.amount),
      categoryId: s.categoryId ?? 'none',
    });
    setModal({});
  };
  const openEdit = (item) => {
    setForm({
      label: item.label,
      bankId: item.bankId?._id ?? item.bankId ?? '',
      dayOfMonth: String(item.dayOfMonth),
      amount: String(item.amount),
      categoryId: item.categoryId ?? 'none',
    });
    setModal({ item });
  };

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val?.target?.value ?? val }));

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        label: form.label,
        bankId: form.bankId,
        dayOfMonth: Number(form.dayOfMonth),
        amount: parseFloat(form.amount),
        categoryId: (form.categoryId && form.categoryId !== 'none') ? form.categoryId : null,
      };
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

  const onDelete = async () => {
    try {
      await removeRecurring(deleteTarget);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  const onGenerate = async (e) => {
    e.preventDefault();
    try {
      const { imported } = await generateRecurring({ month: genMonth, year: genYear });
      toast.success(`${imported} opération(s) générée(s) pour ${MONTHS[genMonth - 1]} ${genYear}`);
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

      <div className="rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Banque</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-center">Jour</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item._id}>
                <TableCell className="font-medium">{item.label}</TableCell>
                <TableCell><Badge variant="secondary">{item.bankId?.label}</Badge></TableCell>
                <TableCell>
                  {item.categoryId
                    ? <CategoryBadge categoryId={item.categoryId} categories={categories} />
                    : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">{item.dayOfMonth}</TableCell>
                <TableCell className={cn('text-right font-semibold', item.amount < 0 ? 'text-rose-600' : 'text-emerald-600')}>
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
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal?.item ? 'Modifier' : 'Nouvelle opération récurrente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="rec-label">Libellé</Label>
              <Input id="rec-label" autoFocus value={form.label} onChange={set('label')} required />
            </div>
            <div className="space-y-1.5">
              <Label>Banque</Label>
              <Select value={form.bankId} onValueChange={set('bankId')}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b._id} value={b._id}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Input id="rec-amount" type="number" step="0.01" value={form.amount} onChange={set('amount')} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Sans catégorie</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color ?? DEFAULT_COLOR }} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <Dialog open={genOpen} onOpenChange={(o) => !o && setGenOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Générer les récurrentes</DialogTitle>
          </DialogHeader>
          <form onSubmit={onGenerate} className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Crée les opérations correspondant aux récurrentes ci-dessus pour le mois choisi.
              Les doublons (même libellé, banque, montant, date) sont ignorés.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mois</Label>
                <Select value={String(genMonth)} onValueChange={(v) => setGenMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((label, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Année</Label>
                <Select value={String(genYear)} onValueChange={(v) => setGenYear(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGenOpen(false)}>Annuler</Button>
              <Button type="submit">Générer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Calcul du budget par catégorie : réel (constaté) vs prévu (récurrentes
// assignées + complément maxAmount, arrondi à la dizaine supérieure). Fonction
// pure partagée entre le widget BudgetSummary et les insights mensuels, pour
// garantir un calcul identique des deux côtés. Les opérations reçues sont
// supposées déjà filtrées des virements internes (transferId) par l'appelant.

// Valeur "directionnelle" signée selon le kind : pour une catégorie debit on
// renvoie -sum (une dépense pure → positif ; un remboursement net → négatif,
// ce qui réduit le réel consommé). On ne clippe pas à 0 : une opération
// positive dans une catégorie debit (remboursement) ne doit pas être
// silencieusement ignorée.
export function directional(sum, kind) {
  const v = kind === 'credit' ? sum : -sum;
  return v === 0 ? 0 : v; // évite -0 (afficherait « -0,00 € »)
}

// Budget arrondi à la dizaine supérieure (ex. 125 → 130).
export function roundBudgetUp(raw) {
  return Math.ceil(raw / 10) * 10;
}

const catKey = (ref) => String(ref?._id ?? ref);

export function computeBudgetRows({ categories = [], recurring = [], operations = [] }) {
  const recurringByCategory = new Map();
  for (const r of recurring) {
    if (!r.categoryId) continue;
    const id = catKey(r.categoryId);
    recurringByCategory.set(id, (recurringByCategory.get(id) ?? 0) + r.amount);
  }
  const actualByCategory = new Map();
  for (const o of operations) {
    if (!o.categoryId) continue;
    const id = catKey(o.categoryId);
    actualByCategory.set(id, (actualByCategory.get(id) ?? 0) + o.amount);
  }

  // 1. Budget / réel par catégorie. Un dépassement exige un budget strictement
  //    positif : on ne « dépasse » pas un budget nul.
  const computed = categories.map((c) => {
    const recurringSum = Math.max(0, directional(recurringByCategory.get(String(c._id)) ?? 0, c.kind));
    const budget = roundBudgetUp(recurringSum + (c.maxAmount ?? 0));
    const actual = directional(actualByCategory.get(String(c._id)) ?? 0, c.kind);
    const ratio = budget > 0 ? actual / budget : 0;
    const over = actual - budget;
    const overBudget = c.kind === 'debit' && budget > 0 && actual > budget;
    return {
      cat: c, budget, actual, ratio, over, overBudget, hasOwn: budget > 0 || actual > 0,
    };
  });
  const byId = new Map(computed.map((r) => [String(r.cat._id), r]));

  // 2. Racines / enfants (1 niveau). parentId orphelin → traité en racine.
  const childrenByParent = new Map();
  const roots = [];
  for (const r of computed) {
    const pid = r.cat.parentId ? String(r.cat.parentId) : null;
    if (pid && byId.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(r);
    } else {
      roots.push(r);
    }
  }

  // 3. Ordre : credit avant debit, puis par (budget + actual) décroissant.
  const score = (r) => r.budget + r.actual;
  const cmp = (a, b) => {
    if (a.cat.kind !== b.cat.kind) return a.cat.kind === 'credit' ? -1 : 1;
    return score(b) - score(a);
  };
  roots.sort(cmp);
  for (const arr of childrenByParent.values()) arr.sort(cmp);

  // 4. Aplatissement avec depth. Une racine s'affiche si elle a un budget/réel
  //    propre, OU si au moins un de ses enfants est visible.
  const rows = [];
  for (const r of roots) {
    const kids = (childrenByParent.get(String(r.cat._id)) ?? []).filter((k) => k.hasOwn);
    if (!r.hasOwn && kids.length === 0) continue;
    rows.push({ ...r, depth: 0 });
    for (const k of kids) rows.push({ ...k, depth: 1 });
  }

  // Totaux. Budget = somme des lignes visibles. Réel = opérations catégorisées
  // dont la catégorie est credit/debit ; transferts et opérations sans
  // catégorie en sont exclus (ces dernières totalisées dans `uncategorized`).
  let budgetCredit = 0; let budgetDebit = 0;
  for (const r of rows) {
    if (r.cat.kind === 'credit') budgetCredit += r.budget;
    else budgetDebit += r.budget;
  }
  const catById = new Map(categories.map((c) => [String(c._id), c]));
  let actualCredit = 0; let actualDebit = 0;
  let uncatCount = 0; let uncatTotal = 0;
  for (const o of operations) {
    if (!o.categoryId) { uncatCount += 1; uncatTotal += o.amount; continue; }
    const cat = catById.get(catKey(o.categoryId));
    if (!cat) continue;
    if (cat.kind === 'credit') actualCredit += o.amount;
    else actualDebit += -o.amount;
  }

  const totals = {
    budgetCredit,
    budgetDebit,
    actualCredit,
    actualDebit,
    budgetNet: budgetCredit - budgetDebit,
    actualNet: actualCredit - actualDebit,
  };

  const overrunItems = rows.filter((r) => r.overBudget).sort((a, b) => b.over - a.over);
  const overruns = {
    items: overrunItems,
    count: overrunItems.length,
    totalOver: overrunItems.reduce((s, r) => s + r.over, 0),
  };

  return {
    rows,
    totals,
    uncategorized: { count: uncatCount, total: uncatTotal },
    overruns,
  };
}

// Sous-catégories : 1 niveau max. parentId pointe vers une catégorie racine du
// même utilisateur. Helpers d'affichage hiérarchique pour selects + listes.

const byLabel = (a, b) =>
  a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });

// Retourne un tableau aplati [{ cat, depth }] dans l'ordre :
//   parent A
//     enfant A1
//     enfant A2
//   parent B
//     enfant B1
// Les orphelins (parentId pointant vers une catégorie absente) sont rendus en
// racine pour ne jamais disparaître.
export function sortCategoriesByHierarchy(categories) {
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const childrenByParent = new Map();
  const roots = [];

  for (const c of categories) {
    const pid = c.parentId ? String(c.parentId) : null;
    if (pid && byId.has(pid)) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(c);
    } else {
      roots.push(c);
    }
  }

  roots.sort(byLabel);
  for (const arr of childrenByParent.values()) arr.sort(byLabel);

  const out = [];
  for (const r of roots) {
    out.push({ cat: r, depth: 0 });
    const kids = childrenByParent.get(String(r._id)) ?? [];
    for (const k of kids) out.push({ cat: k, depth: 1 });
  }
  return out;
}

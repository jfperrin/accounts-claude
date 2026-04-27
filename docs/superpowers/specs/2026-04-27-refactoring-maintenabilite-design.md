# Refactoring maintenabilité — Design

**Date :** 2026-04-27  
**Scope :** Frontend (client/) + Backend (server/)  
**Langage :** JavaScript (pas de migration TypeScript)  
**Objectif :** Améliorer la maintenabilité sans changer le comportement visible

---

## Contexte

L'application est un gestionnaire de finances personnel (banques, opérations, récurrentes, catégories, import QIF/OFX/ZIP). Elle fonctionne correctement mais accumule plusieurs problèmes de structure :

- `DashboardPage.jsx` (~500 lignes) embarque 3 dialogues inline et toute la logique de fetch
- Le rendu d'un badge catégorie est dupliqué dans `OperationsTable.jsx` et `RecurringPage.jsx`
- `routes/operations.js` contient la logique métier d'import/réconciliation directement dans les handlers de routes

---

## Frontend

### 1. Extraction des dialogues de DashboardPage

**Problème :** `DashboardPage.jsx` mélange coordination d'état, logique de fetch, et rendu de 3 dialogues inline.

**Solution :** Extraire chaque dialogue en composant autonome.

| Nouveau fichier | Contenu |
|---|---|
| `client/src/components/ImportDialog.jsx` | Dialogue import QIF/OFX/ZIP — props : `open`, `banks`, `onSubmit`, `onCancel` |
| `client/src/components/MakeRecurringDialog.jsx` | Dialogue conversion en récurrente — props : `open`, `form`, `banks`, `categories`, `onChange`, `onSubmit`, `onCancel` |

`ImportResolveDialog.jsx` existe déjà — inchangé.

`DashboardPage` garde uniquement la coordination d'état (`importOpen`, `recurringForm`, handlers) et délègue le rendu aux composants.

### 2. Composant CategoryBadge

**Problème :** Le rendu d'un badge coloré lié à une catégorie est copié-collé dans `OperationsTable.jsx` (lignes 73–108) et `RecurringPage.jsx` (lignes 129–142).

**Solution :** Créer `client/src/components/CategoryBadge.jsx`.

Interface :
```jsx
<CategoryBadge
  category="Courses"       // string | null
  categories={categories}  // tableau des catégories utilisateur
  onRemove={() => ...}     // optionnel — rend le badge cliquable pour retirer la catégorie
/>
```

- Si `category` est null/vide → retourne `null` (ou un Select selon le contexte appelant)
- Couleur résolue depuis `categories.find(c => c.label === category)?.color ?? DEFAULT_COLOR`
- Variante cliquable quand `onRemove` est fourni (cas `OperationsTable`)
- Variante lecture seule sans `onRemove` (cas `RecurringPage`)

### 3. Hooks de données

**Problème :** `DashboardPage` initialise ~15 lignes de state + useEffect pour charger banques et opérations.

**Solution :** Créer deux hooks sur le modèle de `useCategories` déjà en place.

**`client/src/hooks/useBanks.js`**
```js
// Retourne { banks, reload }
export function useBanks()
```

**`client/src/hooks/useOperations.js`**
```js
// Retourne { operations, reload }
// Recharge automatiquement quand startDate ou endDate change
export function useOperations({ startDate, endDate })
```

`DashboardPage` passe de ~15 lignes de fetch/state à 2 appels de hooks.

---

## Backend

### Extraction du service d'import

**Problème :** `routes/operations.js` contient directement dans ses handlers la logique de parsing de fichier, similarité de libellés, déduplication, auto-catégorie, et résolution de conflits — du code métier mélangé à la couche routing.

**Solution :** Créer `server/services/importService.js` qui expose deux fonctions :

```js
/**
 * Traite un fichier importé (QIF/OFX/ZIP).
 * @returns {{ imported, autoReconciled, duplicates, invalid, pendingMatches }}
 */
async function processImportFile(file, bankId, userId)

/**
 * Finalise les conflits d'import en attente.
 * @returns {{ reconciled, imported }}
 */
async function resolveImportMatches(resolutions, userId)
```

Le handler de route devient :
```js
router.post('/import', upload.single('file'), asyncHandler(async (req, res) => {
  const result = await importService.processImportFile(req.file, req.body.bankId, req.user._id);
  res.json(result);
}));
```

Aucune logique métier dans la route — elle valide, délègue, répond.

**Périmètre :** Seul l'import justifie l'extraction. Les autres handlers (`GET /operations`, `POST /operations`, `PATCH /point`, etc.) sont déjà courts et restent en place.

---

## Ce qui ne change pas

- Comportement fonctionnel de l'application — aucune régression visible
- API serveur — mêmes endpoints, mêmes payloads
- Base de données — aucune migration
- Tests existants (s'il y en a) — doivent continuer à passer

---

## Critères de succès

- `DashboardPage.jsx` passe sous ~200 lignes
- `CategoryBadge` est utilisé à la place du code dupliqué dans les deux fichiers concernés
- `routes/operations.js` ne contient plus de logique métier d'import
- `yarn --cwd client lint` et `yarn --cwd server lint` passent à 0 warnings

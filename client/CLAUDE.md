# client/CLAUDE.md

Détails spécifiques au client React + Vite. Pour l'architecture globale et les commandes, voir [`../CLAUDE.md`](../CLAUDE.md).

## Stack

- **Vite** + **React 18** (JSX, pas de TS côté client)
- **Tailwind CSS v4** (pas de `tailwind.config.js` — config inline dans `src/index.css` via `@theme inline`)
- **shadcn/ui** + **Radix UI** primitives — composants dans `src/components/ui/`. Pas de `components.json`, composants copiés-localisés.
- **axios** (`api/client.js`, `withCredentials: true`)
- **react-router-dom** v6
- **sonner** (toasts), **lucide-react** (icônes), **recharts**, **vanilla-cookieconsent**

## Routing (`App.jsx`)

| Route | Accès |
|-------|-------|
| `/login` | public, redirige vers `/` si déjà connecté |
| `/cgu` | public (CGU) |
| `/reset-password` | public |
| `/*` | derrière `<PrivateRoute>` → `AppShell` avec `<Outlet />` |

Routes protégées : `/` (dashboard), `/banks`, `/recurring`, `/categories`, `/profile`, `/admin`.

Vite proxy : `/api` et `/uploads` → `http://localhost:3001`.

## Couche API (`src/api/`)

Une instance axios partagée (`client.js`) + un fichier par ressource. Chaque méthode renvoie `res.data` directement.

**Convention d'import** :

```js
// ✅ Bon — imports nommés
import { list, create, update } from '@/api/banks';
list().then(setBanks);

// ❌ Mauvais — namespace
import * as banksApi from '@/api/banks';
banksApi.list();
```

**Conflits de noms** (DashboardPage importe operations + banks + recurring, tous ont `list`/`create`/...) → aliaser par ressource :

```js
import {
  create as createOp,
  update as updateOp,
  remove as removeOp,
  point, generateRecurring, importFile, resolveImport,
} from '@/api/operations';
import { update as updateBank } from '@/api/banks';
import { create as createRecurring } from '@/api/recurringOperations';
```

Les `import * as React` et `import * as RadixPrimitive` restent — ils suivent une convention différente (sous-composants accédés via `Primitive.Root`, `Primitive.Trigger`, etc.).

## Auth state (`store/AuthContext.jsx`)

`GET /api/auth/me` au montage. Trois états :
- `undefined` = loading (chargement initial)
- `null` = non authentifié
- objet `User` = authentifié

Expose `login`, `register`, `logout`, `updateUser(u)`. Convention : alias les méthodes API pour éviter les conflits avec les fonctions locales (`login as apiLogin`, etc.).

## Theme system (clair/sombre)

Tailwind v4 sans config externe. Tout dans `src/index.css` :

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme inline { /* mappe les variables OKLch aux couleurs Tailwind */ }
:root { /* palette claire */ }
.dark { /* palette sombre */ }
```

### `ThemeContext` (`store/ThemeContext.jsx`)

- État dans `localStorage` (clé `theme`, défaut `'light'`)
- `useEffect` ajoute/retire la classe `dark` sur `<html>`
- Hook `useTheme()` → `{ theme, toggleTheme }`
- Provider monté dans `main.jsx` autour de `<App />` (à l'intérieur de `<AuthProvider>`)

### `ThemeToggle` (`components/ThemeToggle.jsx`)

Bouton Sun/Moon dans le header (desktop + mobile). Visible toujours, pas de "auto" — l'utilisateur choisit explicitement.

### Forçage de couleurs claires

Certaines pages sont **volontairement claires en dark mode** : `LoginPage`, `ToSPage`. Le card est `bg-white` hardcodé sur fond `bg-slate-900`. Les inputs et boutons à l'intérieur doivent forcer leurs couleurs (sinon ils utilisent `bg-card` qui flippe en noir) :

```jsx
<Input className="h-11 bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
<Button variant="outline" className="bg-white text-slate-900 border-slate-200 hover:bg-slate-50" />
<Label className="text-slate-700">…</Label>
```

`cn()` utilise `twMerge` → les classes passées en props gagnent sur celles du composant.

### Cookie consent (`components/CookieConsent.jsx`)

`vanilla-cookieconsent v3`. Thème indigo via `styles/cookieconsent-theme.css` (variables `--cc-*`). Bloc `.dark #cc-main` override les variables en dark.

## Layout (`components/layout/AppShell.jsx`)

- Desktop : sidebar gauche `hidden md:flex` + header (logo mobile + spacer + ThemeToggle + avatar/nom + déconnexion)
- Mobile : header simple + bottom nav `fixed bottom-0 flex md:hidden` (5-6 tabs incluant Profil et Admin si applicable)
- `pb-24` sur `<main>` mobile pour éviter le chevauchement avec la bottom nav
- `Footer` (`components/layout/Footer.jsx`) : visible uniquement desktop dans AppShell, et inline dans LoginPage / ToSPage

## Composants notables

### `OperationsTable` (`components/OperationsTable.jsx`)

- Select catégorie inline dans la cellule Libellé : la `value` du `<SelectItem>` est l'**`_id`** de la catégorie (pas son libellé), envoyé tel quel comme `categoryId` au serveur. **Sentinelle "none"** : Radix Select interdit `value=""` → utiliser `"none"` côté UI, convertir en `null` avant l'appel API
- Tri décroissant par date, pagination 20/50/100/200
- Mobile : clic sur ligne → toggle `pointed`

### `CategoryBadge` (`components/CategoryBadge.jsx`)

Reçoit `categoryId` + la liste `categories` complète. Lookup par `_id` pour récupérer libellé et couleur. Si l'id est inconnu (catégorie supprimée), ne rend rien — la suppression d'une catégorie déréfère côté serveur (`categoryId → null`), mais ce garde-fou évite un crash si le client a un cache obsolète.

### `CategoryColorPicker` (`components/CategoryColorPicker.jsx`)

Pastille cliquable → popover (rendu via **`createPortal` vers `document.body`**, position `fixed` calculée depuis `getBoundingClientRect`). Échappe l'`overflow:auto` du composant `Table`. Contient :
- grille 12 couleurs préréglées (`lib/categoryColors.js`)
- `<input type="color">` pour le picker natif système

Utilisé dans `CategoriesPage` (édition inline) et le dialog d'édition de catégorie.

**Pourquoi portail** : tout popover/menu rendu dans une cellule de `<Table>` est cliperé — le wrapper du composant Table a `overflow-auto`. Pattern à reproduire pour tout futur popover dans un tableau.

### `AvatarCropDialog` (`components/AvatarCropDialog.jsx`)

À la sélection d'une image dans `ProfilePage`, ouvre un dialog avec :
- Cercle de sélection 280px (overflow-hidden)
- Image positionnée en absolute, draggable via Pointer Events (souris + tactile)
- Slider de zoom (de "couvrir" à 4× le min-scale)
- À la validation : Canvas → JPEG 512×512 qualité 0.9 → upload via `uploadAvatar`

Aucune dépendance ajoutée pour ça — implémentation custom 140 lignes.

### `LoginPage` (`pages/LoginPage.jsx`)

- Onglet **Inscription** : case CGU obligatoire (lien `/cgu` nouvel onglet). Bouton désactivé tant que non cochée. Envoie `acceptedToS: true` à `POST /api/auth/register`.
- Onglet **Connexion** : sélecteur "Rester connecté" (1j / 30j / 365j) → `rememberDays` envoyé à `POST /api/auth/login`
- Le card est blanc dans les deux thèmes (cf. "Forçage de couleurs claires")

### `UserFormModal` (`components/admin/UserFormModal.jsx`)

Création/édition utilisateur côté admin. Champs : email, password (création seulement), rôle, **case à cocher "Email vérifié"**. Le payload envoyé à `POST/PUT /api/admin/users` inclut `emailVerified`.

### `DashboardPage` (`pages/DashboardPage.jsx`)

- Sélecteur de plage de dates (`30d` / `90d` / `custom`), persisté dans cookie `dash_date_range`
- Conversion vers `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` à l'appel API
- Dropdown **Importer** (récurrentes vs fichier) + bouton **Nouvelle opération**
- **FAB** : `IntersectionObserver` sur le bouton "Nouvelle opération" desktop. Quand il sort du viewport, un bouton rond `+` apparaît `bottom-28 right-6` (mobile au-dessus de la bottom nav) ou `bottom-8 right-8` (desktop)
- Badge "Total" flottant top-right quand le bloc des soldes sort du viewport et qu'il y a >1 banque

## Hooks

- `useBanks()` → `{ banks, setBanks, reload }` — `GET /api/banks`
- `useCategories()` → `{ categories, reload }` — `GET /api/categories` (seed automatique)
- `useOperations({ startDate, endDate })` → `{ operations, setOperations, reload }`

## Catégories

- `lib/categoryColors.js` exporte `CATEGORY_COLORS` (palette préréglée 12 hex) et `DEFAULT_COLOR` (`#6366f1`)
- `pages/CategoriesPage.jsx` permet d'éditer la couleur **directement depuis la liste** (popover sur la pastille) ou via le modal complet pour le libellé
- Lien Operation/Recurring → Category par **`categoryId`** (FK sur `_id`), pas par libellé. Renommer une catégorie n'oblige pas à mettre à jour les opérations.

## Linting

- `eslint.config.js` — flat config v9. Plugins : `react`, `react-hooks`, `react-refresh` (désactivé). Règle clé : `react/jsx-uses-vars` (évite les faux `no-unused-vars` sur composants JSX).
- `vite.config.js` — `vite-plugin-eslint2` avec `lintOnStart: true, emitErrorAsWarning: true` → lint à chaque sauvegarde pendant `yarn dev`
- Règles actives : `prefer-const` (error), `no-var` (error), `eqeqeq` (error, null ignoré), `no-unused-vars` (warn), `no-console` (warn, sauf `warn`/`error`)
- Objectif : 0 warning sur `src/`

## Tests (`src/tests/`, vitest)

`LoginPage.test.jsx` couvre les onglets, le sélecteur rememberDays, l'affichage conditionnel du bouton Google, l'import nommé `config` mocké via `vi.mock`.

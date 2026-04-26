# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# From repo root — starts both server (:3001) and client (:5173)
yarn dev

# Install dependencies for both workspaces
yarn install:all          # runs yarn in server/ then client/
yarn --cwd server install
yarn --cwd client install

# Client only
yarn --cwd client build   # production build → client/dist/
yarn --cwd client preview
yarn --cwd client lint    # ESLint (0 warnings expected)
yarn --cwd client lint:fix

# Server only
yarn --cwd server dev     # nodemon watch (+ eslint on each restart)
yarn --cwd server start   # plain node
yarn --cwd server lint    # ESLint (0 warnings expected)
yarn --cwd server lint:fix

# Mobile (reactNative/)
cd reactNative
yarn start                # Expo dev server
yarn android              # Android emulator
yarn ios                  # iOS simulator
yarn test                 # jest-expo (single run)
yarn test:watch
```

## Architecture

Three independent packages sharing the same domain model:

| Package | Stack | Port |
|---------|-------|------|
| `server/` | Node.js / Express 5 / Mongoose / MongoDB | 3001 |
| `client/` | Vite + React / shadcn/ui + Tailwind CSS v4 | 5173 |
| `reactNative/` | Expo / React Native / react-native-paper | — |

---

### Data model

Five entities, all carrying `userId` so every query is scoped to the authenticated user:

- **User** — `email`, `passwordHash`, `googleId`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl`, `emailVerified`, `role`, `acceptedToSAt`
- **Bank** — `label`, `userId`, `currentBalance` (saisi manuellement d'après le site bancaire)
- **RecurringOperation** — `label`, `amount`, `dayOfMonth` (1–31), `bankId`, `userId`, `category`
- **Operation** — `label`, `amount`, `date` (ISO 8601), `pointed` (bool), `bankId`, `userId`, `category`
- **Category** — `label`, `userId`

**Plus de `Period`** : les opérations sont stockées en liste plate, filtrées par `?month=M&year=YYYY` à la lecture.

`amount` négatif = débit, positif = crédit.

**Solde projeté** (calculé serveur dans `routes/banks.js`, renvoyé par `GET /api/banks`) :
```
projectedBalance(bank) = bank.currentBalance + Σ amount des Operation où bankId=bank ET pointed=false
```
Toutes dates confondues : passé non rapproché et futur non encore réalisé entrent dans la somme.

---

### Server (`server/`)

- **Entry:** `index.js` — Express 5, cors, express-session via connect-mongo, passport
- **Auth:** session-based with `passport-local`. `config/passport.js` defines the strategy; `middleware/requireAuth.js` guards all routes except `/api/auth/*`
- **Route pattern:** every route file exports a router; routes use `utils/asyncHandler.js` to forward async errors to Express. All queries include `{ userId: req.user._id }` as a scope filter

#### Auth routes (`routes/auth.js`)

- `serializeUser(u)` retourne `{ _id, email, emailVerified, role, title, firstName, lastName, nickname, avatarUrl, acceptedToSAt }`
- `POST /api/auth/register` — requiert `{ email, password, acceptedToS: true }`. Si `acceptedToS` absent ou faux → 400. Enregistre `acceptedToSAt` à la création.
- `POST /api/auth/login` — Passport LocalStrategy. Bloque les comptes non-vérifiés (email).
- `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/config`
- `PUT /api/auth/profile` — `{ title, firstName, lastName, nickname }`
- `PUT /api/auth/email` — demande changement d'email (envoie lien de confirmation)
- `PUT /api/auth/password` — change mot de passe (vérifie l'ancien, envoie lien d'annulation)
- `POST /api/auth/avatar` — upload avatar (multipart, champ `avatar`)
- `GET /api/auth/verify-email/:token` — valide `email_verify` ou `email_change`
- `POST /api/auth/resend-verification`
- `GET|POST /api/auth/reset-password/:token`
- `GET /api/auth/cancel-password-change/:token`
- `GET|POST /api/auth/google` + `GET /api/auth/google/callback` — OAuth Google

#### Operations endpoints (`routes/operations.js`)

- `GET /api/operations?month=M&year=YYYY` — opérations du mois (mois courant si absents)
- `POST /api/operations` `{ label, amount, date, bankId, category? }` — création
- `PUT /api/operations/:id` `{ ...fields }` — mise à jour (category inclus)
- `DELETE /api/operations/:id`
- `PATCH /api/operations/:id/point` — toggle pointed
- `POST /api/operations/generate-recurring` `{ month, year }` — génère les opérations issues des récurrents pour ce mois. Idempotent (dédup `label|bankId|amount|YYYY-MM-DD`). Propage `category` depuis le template récurrent.
- `POST /api/operations/import` (multipart) `file` + `{ bankId }` — accepte **.qif**, **.ofx** ou **.zip**.
  - **Réconciliation par similarité** (`SIMILARITY_THRESHOLD = 0.7`) : cherche parmi les ops non-pointées du même montant celle dont le libellé est le plus similaire (via `utils/labelSimilarity.js`). Si score ≥ seuil → auto-réconcilie (pointed + label suffixé `(libelléFichier)`) ; sinon → insertion comme nouvelle op pointée.
  - **Déduplication** : une ligne déjà importée (même hash) est ignorée (`duplicates++`).
  - **Auto-catégorie** : à l'insertion, cherche parmi les ops existantes celle dont le libellé est le plus similaire et qui a une catégorie → la copie.
  - Réponse : `{ imported, autoReconciled, duplicates, invalid, pendingMatches }`
- `POST /api/operations/import/resolve` `{ resolutions: [{ importedRow, selectedOpIds }] }` — finalise les conflits. `selectedOpIds` vide = insertion ; sinon chaque op sélectionnée devient pointée + suffixée.

#### Categories (`routes/categories.js`)

- `GET /api/categories` — retourne les catégories de l'utilisateur. Si aucune → seed automatique des catégories par défaut (`constants/categories.js`).
- `POST /api/categories` `{ label }`
- `PUT /api/categories/:id` `{ label }`
- `DELETE /api/categories/:id`

#### Utilitaires

- **`utils/labelSimilarity.js`** — score de similarité [0,1] entre deux libellés bancaires. Combine token overlap (mots significatifs ≥ 3 chars, non purement numériques) et coefficient de Dice sur les trigrammes. Cas spécial mono-token : score = 1 si le token unique est présent dans l'autre liste. `SIMILARITY_THRESHOLD = 0.7` dans operations.js.
- **`utils/parseQif.js`** — parse QIF (codes 1-lettre, encodage UTF-8/Latin-1 auto)
- **`utils/parseOfx.js`** — parse OFX 1.x SGML + 2.x XML
- **`utils/parseHelpers.js`** — `parseDate` (FR DD/MM/YYYY + ISO), `parseAmount` (FR/US/EN)

#### Avatar storage (`middleware/upload.js`)

Conditionnel sur `isDev = !process.env.MONGODB_URI` :
- **Dev** : multer diskStorage → `uploads/avatars/`, 2 MB, servi via `GET /uploads/*`
- **Prod** : multer memoryStorage, 512 KB, stocké en Base64 data URL dans le document User

#### Base de données

Deux backends interchangeables exposant la même interface :

- **SQLite** (`db/sqlite.js`) — utilisé quand `NODE_ENV=development` ou sans `MONGODB_URI`. Fichier `dev.db`. Migrations idempotentes via `ALTER TABLE … ADD COLUMN` avec try/catch.
- **MongoDB** (`db/mongo.js`) — Mongoose. Utilisé en production.

Tables/collections : `users`, `banks`, `operations`, `recurring_operations`, `password_reset_tokens`, `categories`.

Colonnes notables : `users.accepted_tos_at`, `operations.category`, `recurring_operations.category`.

#### Linting serveur

- **`eslint.config.mjs`** — ESLint v9 flat config, CJS, règles Node. Exclut `vitest.config.js` (ESM). Tests dans `tests/**` avec `sourceType: 'module'`.
- **nodemon.json** — `legacyWatch: true` (WSL polling) + event `restart` qui lance `npx eslint . --quiet` (non-bloquant).

---

### Client (`client/src/`)

- **UI library:** shadcn/ui components (`components/ui/`) avec Tailwind CSS v4. Pas d'Ant Design.
- **Auth state:** `store/AuthContext.jsx` appelle `GET /api/auth/me` au montage. `undefined` = loading, `null` = non-authentifié, objet = authentifié. Expose aussi `updateUser(u)`.
- **API layer:** `api/client.js` est une instance axios avec `withCredentials: true`. Chaque ressource a son fichier (`api/banks.js`, `api/operations.js`, `api/categories.js`, etc.) retournant `res.data` directement.
- **Routing** (`App.jsx`) :
  - `/login` — public, redirige vers `/` si déjà connecté
  - `/cgu` — public (CGU, accessible sans authentification)
  - `/reset-password` — public
  - `/*` — derrière `<PrivateRoute>` → `AppShell` avec `<Outlet />`
  - Routes protégées : `/` (dashboard), `/banks`, `/recurring`, `/categories`, `/profile`, `/admin`
- **Vite proxy:** `/api` et `/uploads` → `http://localhost:3001`
- **Theme:** Tailwind CSS v4, palette indigo/violet (`#6366f1`). Favicon `public/favicon.svg`.

#### AppShell (`components/layout/AppShell.jsx`)

- Desktop : sidebar gauche (`hidden md:flex`) + header avec avatar/nom + bouton déconnexion
- Mobile : header logo + bottom nav (`fixed bottom-0`, `flex md:hidden`) — tabs : Accueil, Banques, Récurrents, Catégories, Profil (+ Admin si rôle admin)
- Footer (`components/layout/Footer.jsx`) — visible uniquement desktop, affiché sous le contenu principal. Contient copyright, lien `/cgu`, mention indicative.
- Padding bas mobile `pb-24` pour éviter chevauchement avec la bottom nav

#### Footer (`components/layout/Footer.jsx`)

Composant réutilisable intégré dans `AppShell` (desktop), `LoginPage` et `ToSPage`. Contenu : copyright © année courante, lien CGU, mention de non-responsabilité.

#### CGU (`pages/ToSPage.jsx` → route `/cgu`)

Page publique listant 8 articles : objet, accès, responsabilité données, limitation dysfonctionnements, exonération générale, RGPD, modification CGU, droit applicable. Clauses en encadrés amber.

#### Cookies (`components/CookieConsent.jsx`)

Bandeau cookie via **vanilla-cookieconsent v3** (orestbida, MIT, ~10 KB). Initialisé dans un `useEffect` au montage de `App`. Configuration :
- Catégorie `necessary` (toujours active, non désactivable) — décrit `connect.sid`
- Langue française, lien vers `/cgu`
- Thème indigo/violet via `styles/cookieconsent-theme.css` (variables CSS `--cc-*`)
- Position : bandeau en bas à droite, modale de préférences avec tableau de cookies

#### Catégories

- **`lib/categories.js`** — exporte `CATEGORIES` (tableau des catégories disponibles, partagé client)
- **`hooks/useCategories.js`** — hook `useCategories()` → `{ categories, loading, reload }`
- **`api/categories.js`** — fonctions CRUD : `list()`, `create(data)`, `update(id, data)`, `remove(id)`
- **`pages/CategoriesPage.jsx`** — page CRUD complète (tableau + modale ajout/édition + confirmation suppression)

#### DashboardPage (`pages/DashboardPage.jsx`)

- Sélecteurs mois/année + dropdown **Importer** (2 options : récurrentes / fichier) + bouton **Nouvelle opération**
- **FAB (Floating Action Button)** : `IntersectionObserver` sur le bouton "Nouvelle opération". Quand il sort du viewport, un bouton rond fixe `+` apparaît (`bottom-28 right-6` mobile, `bottom-8 right-8` desktop, au-dessus de la bottom nav sur mobile). Même action que le bouton toolbar.
- `handleCategoryChange(id, category)` → `PUT /api/operations/:id { category }`
- Modale import QIF/OFX/ZIP + modale `ImportResolveDialog` si `pendingMatches`

#### OperationsTable (`components/OperationsTable.jsx`)

- Select catégorie inline dans la cellule Libellé (valeur sentinelle `"none"` → `null` avant API)
- Tri décroissant par date, pagination (tailles : 20/50/100/200)
- Mobile : clic sur ligne → toggle `pointed`

#### OperationForm / RecurringPage

- Select catégorie optionnel dans le formulaire création/édition
- RecurringPage : badge catégorie dans le tableau + champ catégorie dans la modale

#### LoginPage (`pages/LoginPage.jsx`)

- Onglet **Inscription** : case à cocher "J'accepte les CGU" (lien `/cgu` nouvel onglet). Bouton désactivé tant que non cochée. Envoie `{ email, password, acceptedToS: true }` à `POST /api/auth/register`.
- Radix UI Select : valeur vide `""` interdite — utiliser sentinelle `"none"` convertie en `null` avant appel API.

#### Linting client

- **`eslint.config.js`** — ESLint v9 flat config. Plugins : `react`, `react-hooks`, `react-refresh` (désactivé car faux positifs). Règle clé : `react/jsx-uses-vars` pour éviter les faux positifs `no-unused-vars` sur les composants JSX.
- **`vite.config.js`** — `vite-plugin-eslint2` avec `lintOnStart: true, emitErrorAsWarning: true` → lint automatique à chaque sauvegarde pendant `yarn dev`.
- Règles actives : `prefer-const` (error), `no-var` (error), `eqeqeq` (error, null ignoré), `no-unused-vars` (warn), `no-console` (warn, sauf `warn`/`error`).

---

### Mobile (`reactNative/`)

**⚠ Non encore migré** vers le nouveau modèle (pas de Period + currentBalance + categories). Cassé en l'état — la doc ci-dessous décrit l'ancienne architecture.

Expo (SDK 55) app TypeScript. Quatre écrans bottom-tab : Dashboard, Banks, Recurring, Profile.

#### Dual data source (IS_LOCAL)

| Condition | Backend |
|-----------|---------|
| `__DEV__` et `EXPO_PUBLIC_USE_LOCAL_DB !== "false"` | SQLite (expo-sqlite) |
| prod ou `EXPO_PUBLIC_USE_LOCAL_DB=false` | HTTP API |

#### Local SQLite layer (`src/db/`)

- `client.ts` — singleton `getDb()`, migrations idempotentes, `generateId()` → `<timestamp_b36><random>`
- `db/repositories/` — un fichier par entité, SQL brut

#### Auth (`src/store/AuthContext.tsx`)

Même pattern trois-états. `User` inclut : `_id`, `username`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl`.

---

## Environment

### Server (`server/.env`, gitignored)

```
MONGODB_URI=<mongodb+srv connection string>
PORT=3001
SESSION_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:3001
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
RATE_LIMIT_MAX=20
```

### Mobile (`reactNative/.env`, gitignored)

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_USE_LOCAL_DB=
```

---

## Notes de développement

- **WSL + OneDrive** : HMR client utilise `usePolling: true, interval: 100` dans `vite.config.js`. Nodemon serveur utilise `legacyWatch: true, delay: 500` dans `nodemon.json`.
- **Backport SQLite** : toute nouvelle colonne ajoutée au modèle doit avoir un `ALTER TABLE … ADD COLUMN` dans le bloc de migrations idempotentes de `db/sqlite.js` (try/catch).
- **Similarité libellés** : `SIMILARITY_THRESHOLD = 0.7` dans `routes/operations.js`. Partagé entre auto-catégorie à l'import et réconciliation.
- **Catégories par défaut** : définies dans `server/constants/categories.js`, seedées automatiquement au premier `GET /api/categories` si l'utilisateur n'en a aucune.

# server/CLAUDE.md

Détails spécifiques au serveur Express. Pour l'architecture globale et les commandes, voir [`../CLAUDE.md`](../CLAUDE.md).

## Entry & app factory

- `index.js` : choisit le backend DB (SQLite si `NODE_ENV=development` ou pas de `MONGODB_URI`, sinon Mongoose)
- `app.js` : factory `createApp(db, mongoUri)` exporté pour les tests. Helmet, CORS (origin `CLIENT_URL`), session, Passport, attache `db` à `app.locals.db`

## Repository pattern

Deux backends interchangeables exposant **la même interface** :

| Backend | Fichier | Quand |
|---------|---------|-------|
| SQLite | `db/sqlite.js` (better-sqlite3, sync) | `NODE_ENV=development` ou sans `MONGODB_URI` |
| MongoDB | `db/mongo.js` (Mongoose) | prod |

Repos exposés : `users`, `banks`, `operations`, `recurringOps`, `resetTokens`, `categories`, `categoryHints`.

**Règle d'or** : les routes ne savent pas quel backend est actif. Tout passe par `req.app.locals.db.<repo>.<method>`. Toute nouvelle méthode doit être implémentée des deux côtés.

### Ajouter une colonne / champ

1. SQLite : `ALTER TABLE ... ADD COLUMN` dans le bloc try/catch de `initSchema` (idempotent)
2. MongoDB : ajouter le champ au schéma Mongoose
3. Mapper SQLite (`mapXxx`) : exposer la valeur en camelCase
4. Mettre à jour les `create`/`update` des deux côtés

## Routes

Toutes les routes (sauf `/api/auth/*`) passent par `requireAuth` ; `/api/admin/*` ajoute `requireAdmin`. Chaque handler est wrappé par `utils/asyncHandler.js` pour propager les erreurs async.

| Préfixe | Routes principales |
|---------|---------------------|
| `/api/auth` | `me`, `login`, `register`, `logout`, `config`, `profile`, `email`, `password`, `avatar`, `verify-email/:token`, `resend-verification`, `reset-password/:token`, `cancel-password-change/:token`, `google`, `google/callback` |
| `/api/banks` | CRUD |
| `/api/operations` | CRUD + `:id/point` (toggle) + `generate-recurring` + `import` (multipart) + `import/resolve` |
| `/api/recurring-operations` | CRUD |
| `/api/categories` | CRUD (seed auto au 1er GET si vide) |
| `/api/category-hints` | `GET`, `POST /rebuild`, `DELETE` *(cache d'auto-affectation)* |
| `/api/admin/users` | CRUD + `:id/reset-password` + `:id/verify-email` |

### Lecture des opérations

`GET /api/operations?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (les deux requis ensemble). Sans paramètre → 30 derniers jours. Renvoie 400 si un seul des deux est fourni.

⚠ L'ancien format `?month=M&year=YYYY` n'existe plus.

### Admin emailVerified

- `POST /api/admin/users` accepte `emailVerified` (défaut `false`)
- `PUT /api/admin/users/:id` accepte `emailVerified` ; si non fourni, la valeur courante est préservée
- `POST /api/admin/users/:id/verify-email` reste disponible pour la vérification rapide via icône (idempotent)

## Service d'import (`services/importService.js`)

L'import accepte `.qif`, `.ofx`, ou `.zip` (qui doit contenir un `.qif`/`.ofx`). 1 MB max via multer mémoire.

### Constantes (clés du fonctionnement)

```js
SIMILARITY_THRESHOLD = 0.7   // seuil de labelSimilarity pour matcher
DATE_WINDOW_DAYS = 15        // ±15 jours autour de la ligne importée
AMOUNT_TOLERANCE = 0.10      // ±10 % autour du montant de la ligne
```

Les trois sont au sommet du fichier — modifier au même endroit pour ajuster le comportement.

### Pipeline `processImportFile`

1. Parse le fichier (QIF ou OFX)
2. Charge `existing = operations.findAllMinimal(userId)` et indexe par bankId
3. Charge les hints via `loadHints` (lazy init : si vide → `rebuildFromOperations` puis re-fetch)
4. Construit un index inversé tokens → hints via `utils/tokenIndex.js`
5. Pour chaque ligne :
   - **Dédup stricte** (même `label|bankId|amount|YYYY-MM-DD`) → `duplicates++`
   - **Dédup marker** (op pointée du même bank+amount-tolérant+date-proche dont le label finit par ` (rowLabel)`) → `duplicates++`
   - **Candidats** : ops du même bank dans la fenêtre date ET tolérance montant ET non pointées ET non consommées
   - Si meilleur candidat avec `labelSimilarity ≥ SIMILARITY_THRESHOLD` → réconciliation : `pointed=true`, label suffixé `(rowLabel)`, **et `amount = r.amount`** (le fichier fait foi)
   - Sinon → insertion (pointed=true, catégorie inférée via hints + token index, hint upserté pour le nouveau libellé)

### Tolérance montant (`withinAmountTolerance`)

`|opAmount - rowAmount| ≤ |rowAmount| × 0.10`, **même signe obligatoire** (un débit ne match jamais un crédit).

### Écrasement du montant à la réconciliation

Une op pré-saisie (récurrente, manuelle approximative) à 800 € qui se réconcilie avec une ligne du fichier à 805 € passe à 805 €. Le solde projeté reflète donc la réalité bancaire après import. Idem dans `resolveImportMatches` (résolution manuelle).

## Category hints (cache d'auto-affectation)

Une entrée par couple `(userId, label)` unique. Beaucoup plus petit que `operations` → le scan d'inférence est rapide.

### Synchronisation

| Évènement | Action |
|-----------|--------|
| `POST /api/operations` avec `category` | upsert hint |
| `PUT /api/operations/:id` avec `category` truthy | upsert hint |
| `PUT /api/operations/:id` avec `category` null/falsy | delete hint pour ce label |
| Inférence pendant import | upsert hint pour le libellé importé |
| `POST /api/category-hints/rebuild` | reset + recalcul (catégorie majoritaire par label, à égalité la plus récente) |
| `DELETE /api/category-hints` | reset complet |
| 1er import si table vide pour l'utilisateur | rebuild lazy auto |

### Token inverted index (`utils/tokenIndex.js`)

`buildTokenIndex(items, getLabel)` → `Map<token, items[]>`. `findCandidates(index, label)` retourne les items partageant au moins un token significatif. Réduit `inferCategory` de O(N×M) à O(C×M) où C ≪ N.

## Utilitaires de parsing

- `utils/labelSimilarity.js` — score [0,1]. Combine token overlap (mots ≥ 3 chars, non purement numériques) + Dice sur trigrammes ; cas spécial mono-token (score = 1 si présent dans l'autre liste). Exporte aussi `tokenize(label)` pour les index.
- `utils/parseQif.js` — codes 1-lettre (D/T/U/P/M/^), encodage UTF-8 strict avec fallback Latin-1
- `utils/parseOfx.js` — OFX 1.x SGML + 2.x XML
- `utils/parseHelpers.js` — `parseDate` (DD/MM/YYYY, DD-MM-YYYY, ISO) ; `parseAmount` (auto-détection séparateur décimal)

## Avatar storage (`middleware/upload.js`)

Conditionnel sur `isDev = !process.env.MONGODB_URI` :
- **Dev** : multer diskStorage → `uploads/avatars/`, 2 MB, servi via `GET /uploads/*`
- **Prod** : multer memoryStorage, 512 KB, stocké en Base64 data URL dans le document User

Le client envoie maintenant l'image **déjà recadrée en JPEG carré 512×512** (~50-150 KB) — voir `client/src/components/AvatarCropDialog.jsx`.

## Tests (`tests/`, vitest)

- `helpers.js` : `setup()` (MongoMemoryServer + createApp), `teardown()`, `clearDB()`, `createVerifiedUser()`
- Couverture : auth, banks, operations, recurringOperations, categories, categoryHints, admin, import (QIF + resolve)
- Toutes les routes admin et import testent l'auth, les permissions cross-user, les cas limites

Lancer : `yarn --cwd server test`. Sur Windows + WSL/OneDrive, vitest peut échouer sur les bindings rolldown — exécuter dans un environnement clean (Linux ou Windows natif sans WSL).

## Linting

- `eslint.config.mjs` — flat config v9, CJS Node. Tests dans `tests/**` avec `sourceType: 'module'`. Exclut `vitest.config.js`.
- `nodemon.json` — `legacyWatch: true` (WSL polling) + relance lint sur restart (non bloquant).

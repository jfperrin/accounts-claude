# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt. Voir aussi
[`server/CLAUDE.md`](server/CLAUDE.md) et [`client/CLAUDE.md`](client/CLAUDE.md)
pour les détails spécifiques.

## Commands

```bash
# From repo root — starts both server (:3001) and client (:5173)
yarn dev

# Install both workspaces
yarn install:all          # runs yarn in server/ then client/

# Client
yarn --cwd client build   # production build → client/dist/
yarn --cwd client preview
yarn --cwd client lint    # ESLint (0 warnings expected)

# Server
yarn --cwd server dev     # nodemon watch (+ eslint on each restart)
yarn --cwd server start
yarn --cwd server lint
yarn --cwd server test    # vitest run

# Mobile (reactNative/)
cd reactNative
yarn start                # Expo dev server
```

## Architecture

Trois packages indépendants partageant le même modèle de domaine :

| Package | Stack | Port |
|---------|-------|------|
| `server/` | Node.js / Express 5 / Mongoose ou SQLite | 3001 |
| `client/` | Vite + React / shadcn/ui + Tailwind CSS v4 | 5173 |
| `reactNative/` | Expo / React Native | — |

### Modèle de domaine

Toutes les entités portent `userId` — chaque requête est scopée à l'utilisateur authentifié.

- **User** — `email`, `passwordHash`, `googleId`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl`, `emailVerified`, `role`, `acceptedToSAt`
- **Bank** — `label`, `userId`, `currentBalance` (saisi manuellement d'après le site bancaire)
- **RecurringOperation** — `label`, `amount`, `dayOfMonth` (1–31), `bankId`, `userId`, `category`
- **Operation** — `label`, `amount`, `date` (ISO 8601), `pointed` (bool), `bankId`, `userId`, `category`
- **Category** — `label`, `color`, `userId`
- **CategoryHint** — `label`, `category`, `userId` *(cache d'auto-affectation à l'import — voir `server/CLAUDE.md`)*

`amount` négatif = débit, positif = crédit. **Pas de `Period`** — les opérations sont une liste plate filtrée par plage de dates à la lecture.

**Solde projeté** (calculé serveur dans `routes/banks.js`, renvoyé par `GET /api/banks`) :
```
projectedBalance(bank) = bank.currentBalance + Σ amount des Operation où bankId=bank ET pointed=false
```
Toutes dates confondues : passé non rapproché et futur non encore réalisé entrent dans la somme.

### Authentification

Sessions Express via `passport-local` (cookie `connect.sid`, `connect-mongo` en prod, MemoryStore en dev). Comptes non vérifiés bloqués au login. Voir `server/routes/auth.js` pour les flows email-verify, password-reset, OAuth Google.

## Environment

### `server/.env` (gitignored)

```
MONGODB_URI=<mongodb+srv connection string>   # vide → SQLite
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

### `reactNative/.env` (gitignored)

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_USE_LOCAL_DB=
```

## Conventions cross-cutting

- **Imports nommés** : utiliser `import { fn1, fn2 } from '@/api/...'` plutôt que `import * as ns`. Si conflit (plusieurs API avec `list`/`create`/etc.) → aliaser par ressource (`createOp`, `updateBank`, `listRecurring`...).
- **Backport SQLite** : toute nouvelle colonne du modèle doit avoir un `ALTER TABLE ADD COLUMN` dans le bloc de migrations idempotentes de `server/db/sqlite.js` (try/catch).
- **WSL + OneDrive** : HMR Vite avec `usePolling: true, interval: 100` ; nodemon avec `legacyWatch: true`.
- **Lint à 0 warning** : objectif sur les deux workspaces.

## Mobile

⚠ **Non migré** vers le modèle actuel (pas de `currentBalance`, pas de `categories`, pas de `category_hints`). Cassé en l'état. Le code décrit une architecture précédente avec dual data source (SQLite local en `__DEV__`, HTTP API en prod).

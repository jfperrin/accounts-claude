# CLAUDE.md

Guide pour Claude Code (claude.ai/code) sur ce dépôt. Voir aussi
[`server/CLAUDE.md`](server/CLAUDE.md) et [`client/CLAUDE.md`](client/CLAUDE.md)
pour les détails spécifiques.

## Style des réponses

- Concis. Un diff parle de lui-même — ne pas le re-décrire en prose.
- Pas de "I'll start by…", "Let me…", récap d'intention avant action.
- Pas d'emoji dans le code, les commits, les docs (sauf demande explicite).
- Listes plutôt que paragraphes ; phrases courtes.
- Fin de tâche : 1-2 phrases max sur ce qui a changé. Pas de "next steps" non demandés.
- Code : pas de commentaire qui décrit le QUOI (le code le fait). Commenter le POURQUOI quand non-évident.
- Ne pas écrire de fichiers `.md` (plans, notes, résumés) sauf demande explicite — travailler dans la conversation.

## Niveau d'exigence

Écrire le code comme un développeur senior front-end **et** back-end :
typage strict des contrats d'API, séparation claire des couches, gestion explicite
des erreurs/cas limites, accessibilité de base (rôles ARIA, focus, contraste, états
de chargement), responsive mobile-first, perfs (rendu inutile, requêtes redondantes,
bundle size), sécurité (validation côté serveur même si déjà côté client, jamais
de secret côté client, scoping `userId` systématique). Pas de "ça compile, ça suffit" —
chaque diff doit être défendable en revue.

## Skills à utiliser

- **`impeccable`** — pour toute modification d'interface (composant, page, layout, formulaire,
  états vides/erreurs, theming, micro-interactions, accessibilité, responsive). À invoquer
  via le tool `Skill` avant d'écrire du code UI.
- **`vercel-react-best-practices`** — à invoquer pour toute écriture/refacto de code React :
  guide officiel Vercel sur les patterns de perf (mémoïsation, Suspense, data fetching,
  bundle, hooks). À combiner avec Context7 pour la doc API à jour.
- **`webapp-testing` (Playwright)** — après toute modification UI ou de flow utilisateur,
  valider en lançant le client/serveur en local et en pilotant le navigateur via les outils
  `mcp__playwright__*` : naviguer sur le scénario impacté, vérifier l'absence d'erreurs
  console, screenshot si pertinent. Le lint et les tests unitaires ne remplacent pas cette
  vérification — un build vert n'est pas une feature qui marche.
- **Context7 MCP** — avant tout usage non-trivial d'une lib/framework (React, Vite,
  Tailwind v4, shadcn/ui, Mongoose, Express 5, Vitest, otplib, Resend, etc.), interroger
  Context7 (`resolve-library-id` puis `query-docs`) pour récupérer la doc à jour. Les
  best practices React / Next bougent vite (concurrent features, hooks d'auth, Suspense,
  Server Components côté Vite-React via libs tierces, etc.) — ne jamais se fier à la
  mémoire entraînée. Préférer Context7 à WebSearch pour la doc d'API.

## Tests obligatoires à chaque modification

Avant de déclarer une tâche terminée, exécuter **systématiquement** :

```bash
yarn --cwd server lint && yarn --cwd server test
yarn --cwd client lint && yarn --cwd client test --run
```

Objectif : 0 warning, 0 test échoué. Si la modif touche l'UI, **enchaîner avec une
validation Playwright** (voir section Skills). Ne pas committer ni rendre la main
sans avoir vu ces commandes passer dans leur intégralité — pas de "j'ai testé le
fichier modifié, ça suffit".

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

# E2E (e2e/, Playwright)
cd e2e && yarn install         # une fois — install + télécharge les navigateurs
cd e2e && yarn test            # run en mode headless
cd e2e && yarn test:ui         # mode interactif
```

E2E lance automatiquement `yarn dev` à la racine (server + client) si rien ne tourne déjà. Variables d'env hardcodées dans `e2e/playwright.config.js` : `ADMIN_EMAIL=e2e-admin@test.local`, `ADMIN_PASSWORD=e2eAdminPass123`, `MFA_ENCRYPTION_KEY=000…` (64×0), `RATE_LIMIT_MAX=1000`. Le compte admin est seedé au boot par `ensureAdmin` — les tests s'y connectent directement.

## Architecture

Deux packages applicatifs + tests E2E, partageant le même modèle de domaine :

| Package | Stack | Port |
|---------|-------|------|
| `server/` | Node.js / Express 5 / Mongoose ou SQLite | 3001 |
| `client/` | Vite + React / shadcn/ui + Tailwind CSS v4 | 5173 |
| `e2e/` | Playwright | — |

### Modèle de domaine

Toutes les entités portent `userId` — chaque requête est scopée à l'utilisateur authentifié.

- **User** — `email`, `passwordHash`, `googleId`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl`, `emailVerified`, `role`, `acceptedToSAt`
- **Bank** — `label`, `userId`, `currentBalance` (saisi manuellement d'après le site bancaire)
- **RecurringOperation** — `label`, `amount`, `dayOfMonth` (1–31), `bankId`, `userId`, `categoryId` (FK → Category)
- **Operation** — `label`, `amount`, `date` (ISO 8601), `pointed` (bool), `bankId`, `userId`, `categoryId` (FK → Category)
- **Category** — `label`, `color`, `maxAmount`, `kind` (`debit`|`credit`), `userId`
- **CategoryHint** — `label`, `categoryId`, `userId` *(cache d'auto-affectation à l'import — voir `server/CLAUDE.md`)*

Les opérations et récurrentes pointent une catégorie par `_id` (FK), pas par libellé : renommer une catégorie n'oblige pas à toucher aux opérations. Suppression d'une catégorie : `categoryId` → `null` sur les ops/recurring (ON DELETE SET NULL en SQLite, équivalent en JS dans `categories.delete` côté Mongo) ; les hints associés sont supprimés (CASCADE).

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
MFA_ENCRYPTION_KEY=<64 hex chars>
MFA_ISSUER=Comptes
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
MOCK_ANTHROPIC=                              # 1 en test E2E pour bypass de l'appel réseau
```

## Conventions cross-cutting

- **Imports nommés** : utiliser `import { fn1, fn2 } from '@/api/...'` plutôt que `import * as ns`. Si conflit (plusieurs API avec `list`/`create`/etc.) → aliaser par ressource (`createOp`, `updateBank`, `listRecurring`...).
- **Backport SQLite** : toute nouvelle colonne du modèle doit avoir un `ALTER TABLE ADD COLUMN` dans le bloc de migrations idempotentes de `server/db/sqlite.js` (try/catch).
- **WSL + OneDrive** : HMR Vite avec `usePolling: true, interval: 100` ; nodemon avec `legacyWatch: true`.
- **Lint à 0 warning** : objectif sur les deux workspaces.

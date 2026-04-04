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

# Server only
yarn --cwd server dev     # nodemon watch
yarn --cwd server start   # plain node

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
| `client/` | Vite + React / Ant Design 6 | 5173 |
| `reactNative/` | Expo / React Native / react-native-paper | — |

---

### Data model

Five entities, all carrying `userId` so every query is scoped to the authenticated user:

- **User** — `username`, `passwordHash`
- **Bank** — `label`, `userId`
- **RecurringOperation** — `label`, `amount`, `dayOfMonth` (1–31), `bankId`, `userId`
- **Period** — `month` (1–12), `year`, `balances` (`{ [bankId]: initialBalance }`), `userId` — unique on `(month, year, userId)`
- **Operation** — `label`, `amount`, `date` (ISO 8601), `pointed` (bool), `bankId`, `periodId`, `userId`

`amount` negative = debit, positive = credit. Bank balances are computed client-side by summing operations grouped by `bankId`.

---

### Server (`server/`)

- **Entry:** `index.js` — Express 5, cors, express-session via connect-mongo, passport
- **Auth:** session-based with `passport-local`. `config/passport.js` defines the strategy; `middleware/requireAuth.js` guards all routes except `/api/auth/*`
- **Route pattern:** every route file exports a router; routes use `utils/asyncHandler.js` to forward async errors to Express. All queries include `{ userId: req.user._id }` as a scope filter
- **Import recurring:** `POST /api/operations/import-recurring` — idempotent, deduplicates by `label|bankId|amount` key before `insertMany`

---

### Client (`client/src/`)

- **Auth state:** `store/AuthContext.jsx` calls `GET /api/auth/me` on mount. `undefined` = loading (shows `<Spin fullscreen />`), `null` = unauthenticated
- **API layer:** `api/client.js` is an axios instance with `withCredentials: true`. Each resource has its own file (`api/banks.js`, etc.) returning `res.data` directly via a response interceptor
- **Routing:** `App.jsx` — `/login` (public) + `/*` behind `<PrivateRoute>`. The nested route layout renders `AppShell` (sidebar + header) with `<Outlet />`
- **Vite proxy:** `/api` → `http://localhost:3001`, so there are no CORS issues and the session cookie is first-party
- **Theme:** antd 6 `ConfigProvider` in `main.jsx` — primary color `#6366f1` (indigo), dark sider `#1e1e2e`. Token overrides are inline in `main.jsx`; `theme.js` is unused and can be removed

**Key behaviours:**
- A `Period` is created on demand (in `DashboardPage`) when the user adds an operation or imports recurring ops
- Pointed operations are visually dimmed via `.op-pointed td { opacity: 0.5 }` inline style in `DashboardPage`
- `Space.Compact` from antd is used in `RecurringPage` modal — still present in antd 6

---

### Mobile (`reactNative/`)

Expo (SDK 55) app in TypeScript. Three bottom-tab screens: **Dashboard**, **Banks**, **Recurring**.

#### Dual data source (IS_LOCAL)

Every service (`src/services/*.ts`) dispatches to one of two backends via the `IS_LOCAL` flag:

| Condition | Backend | Typical use |
|-----------|---------|-------------|
| `__DEV__` and `EXPO_PUBLIC_USE_LOCAL_DB !== "false"` | SQLite (expo-sqlite) | Offline dev |
| prod or `EXPO_PUBLIC_USE_LOCAL_DB=false` | HTTP API (server) | Production |

Override in `reactNative/.env`:
```
EXPO_PUBLIC_USE_LOCAL_DB=false   # force API in dev
EXPO_PUBLIC_API_URL=http://...   # override server URL
```

#### Local SQLite layer (`src/db/`)

- `client.ts` — singleton `getDb()` opens `accounts.db` and runs migrations on first call; `generateId()` produces `<timestamp_b36><random>` primary keys
- `migrations.ts` — idempotent `CREATE TABLE IF NOT EXISTS` for all five tables (WAL mode)
- `db/repositories/` — one file per entity, raw SQL via `expo-sqlite`

#### API layer (`src/api/`)

- `client.ts` — axios instance pointing to `http://10.0.2.2:3001/api` (Android) or `localhost:3001` (iOS); unwraps `{ data }` envelope via interceptor
- One file per resource (`banks.ts`, `operations.ts`, etc.)

#### Auth (`src/store/AuthContext.tsx`)

Same three-state pattern as the web client: `undefined` = loading (spinner), `null` = unauthenticated, `User` = authenticated. `authService.me()` is called on mount.

#### Navigation

- `RootNavigator` — native stack: `Login` screen or `App` (bottom tabs) depending on auth state
- `AppNavigator` — bottom tabs with MaterialCommunityIcons

#### Theme

`src/theme/colors.ts` exports `palette` — same indigo-based palette as the web client (`indigo500: #6366f1`). `react-native-paper` is used for UI components.

#### Tests

`jest-expo` with `@testing-library/react-native`. Tests live in `src/__tests__/` mirroring the source tree (components, db/repositories, hooks, services).

---

## Environment

### Server (`server/.env`, gitignored)

```
MONGODB_URI=<mongodb+srv connection string>
PORT=3001          # optional, defaults to 3001
SESSION_SECRET=    # optional, defaults to 'dev_secret'
```

### Mobile (`reactNative/.env`, gitignored)

```
EXPO_PUBLIC_API_URL=        # optional, overrides auto-detected server URL
EXPO_PUBLIC_USE_LOCAL_DB=   # true | false — overrides IS_LOCAL logic
```

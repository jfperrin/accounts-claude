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
| `client/` | Vite + React / shadcn/ui + Tailwind CSS v4 | 5173 |
| `reactNative/` | Expo / React Native / react-native-paper | — |

---

### Data model

Five entities, all carrying `userId` so every query is scoped to the authenticated user:

- **User** — `username`, `passwordHash`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl`
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
- **Auth routes** (`routes/auth.js`):
  - `serializeUser(u)` helper returns `{ _id, username, title, firstName, lastName, nickname, avatarUrl }` — used by `/register`, `/login`, `/me`
  - `PUT /api/auth/profile` — updates `{ title, firstName, lastName, nickname }`
  - `POST /api/auth/avatar` — uploads avatar; uses `middleware/upload.js`
- **Avatar storage** (`middleware/upload.js`): conditional on `isDev = !process.env.MONGODB_URI`:
  - **Dev** (no MONGODB_URI): multer diskStorage → `uploads/avatars/`, 2 MB limit, served via `GET /uploads/*`
  - **Prod** (MONGODB_URI set): multer memoryStorage, 512 KB limit, stored as Base64 data URL (`data:<mime>;base64,...`) directly in the User document
- **Static files:** `/uploads` is served only in dev (`app.js` conditionally adds the static middleware)
- **Error handling:** global error handler detects `MulterError` or custom image-filter errors and returns 400 instead of 500

---

### Client (`client/src/`)

- **UI library:** shadcn/ui components (`components/ui/`) with Tailwind CSS v4. No Ant Design.
- **Auth state:** `store/AuthContext.jsx` calls `GET /api/auth/me` on mount. `undefined` = loading (spinner), `null` = unauthenticated, object = authenticated user. Also exposes `updateUser(u)` to update auth state after profile changes.
- **API layer:** `api/client.js` is an axios instance with `withCredentials: true`. Each resource has its own file (`api/banks.js`, `api/profile.js`, etc.) returning `res.data` directly via a response interceptor.
- **Routing:** `App.jsx` — `/login` (public) + `/*` behind `<PrivateRoute>`. The nested route layout renders `AppShell` with `<Outlet />`. Routes: `/` (dashboard), `/banks`, `/recurring`, `/profile`.
- **Vite proxy:** `/api` and `/uploads` → `http://localhost:3001`
- **Theme:** Tailwind CSS v4 with indigo/violet palette (`#6366f1`). shadcn/ui components in `components/ui/`.
- **Favicon:** `public/favicon.svg` — wallet icon on indigo→violet gradient rounded square

**AppShell (`components/layout/AppShell.jsx`):**
- Desktop: left sidebar (`hidden md:flex`) + top header with username/avatar
- Mobile: top header with logo + bottom navigation bar (`fixed bottom-0`, `flex md:hidden`) with 4 tabs: Accueil, Banques, Récurrents, Profil
- Main content has extra bottom padding on mobile (`pb-24`) to clear the bottom nav
- Displays `user.nickname || user.username` as display name; `user.avatarUrl` as avatar (data URL or relative path)

**Key behaviours:**
- A `Period` is created on demand (in `DashboardPage`) when the user adds an operation or imports recurring ops
- Operations are sorted by date ascending on load (`DashboardPage`)
- Recurring operations are sorted by `dayOfMonth` ascending on load (`RecurringPage`)
- Pointed operations are visually dimmed (opacity 50%) via Tailwind class
- Mobile only: clicking an operation row calls `onPoint` to toggle pointed state (desktop uses a dedicated button/switch)
- `DashboardPage` computes `totalProjected` (sum across all banks with a set balance) via `useMemo` and renders a sticky card at 5px from top, mobile only (`sticky top-[5px] z-10 md:hidden`). The duplicate total card inside `BankBalances` is hidden on mobile (`hidden md:block`).
- Radix UI Select: empty string `""` is forbidden as item value — use sentinel `"none"` and convert to `null` before API calls

**Profile page (`pages/ProfilePage.jsx`):**
- Edit title (Mr/Mme/etc.), firstName, lastName, nickname
- Upload avatar via hidden file input → `api/profile.js uploadAvatar()`
- Logout button at bottom of form
- Avatar src is used directly as `user.avatarUrl` (data URL or relative path — both work)

---

### Mobile (`reactNative/`)

Expo (SDK 55) app in TypeScript. Four bottom-tab screens: **Dashboard**, **Banks**, **Recurring**, **Profile**.

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
- `migrations.ts` — idempotent `CREATE TABLE IF NOT EXISTS` for all five tables (WAL mode); profile columns (`title`, `first_name`, `last_name`, `nickname`, `avatar_url`) are added via `ALTER TABLE` with try/catch per column (idempotent)
- `db/repositories/` — one file per entity, raw SQL via `expo-sqlite`
- `db/repositories/profile.ts` — `updateProfile(userId, data)` and `updateAvatar(userId, imageUri)` (copies image to app documents dir via `expo-file-system`)

#### API layer (`src/api/`)

- `client.ts` — axios instance pointing to `http://10.0.2.2:3001/api` (Android) or `localhost:3001` (iOS); unwraps `{ data }` envelope via interceptor
- One file per resource (`banks.ts`, `operations.ts`, `profile.ts`, etc.)

#### Auth (`src/store/AuthContext.tsx`)

Same three-state pattern as the web client: `undefined` = loading (spinner), `null` = unauthenticated, `User` = authenticated. `authService.me()` is called on mount. Also exposes `updateUser(u: User)` to update auth state after profile changes.

`User` type includes: `_id`, `username`, `title`, `firstName`, `lastName`, `nickname`, `avatarUrl` (all nullable except `_id` and `username`).

#### Navigation

- `RootNavigator` — native stack: `Login` screen or `App` (bottom tabs) depending on auth state
- `AppNavigator` — bottom tabs with MaterialCommunityIcons: Dashboard, Banks, Recurring, Profile

#### Profile screen (`src/screens/ProfileScreen.tsx`)

- Title picker (button row), TextInput for firstName/lastName/nickname
- Image picker via `expo-image-picker` with permissions, calls `profileService.updateAvatar`
- Uses `useAuthContext()` (not `useAuth`)

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

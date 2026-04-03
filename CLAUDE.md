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
```

There are no test runners configured.

## Architecture

Full-stack account management app. `server/` is a Node.js/Express API, `client/` is a Vite+React SPA. Both are independent yarn workspaces launched together from the root.

### Data model

Five Mongoose models, all carrying `userId` so every query is automatically scoped to the authenticated user:

- **User** — `username`, `passwordHash`
- **Bank** — `label`, `userId`
- **RecurringOperation** — `label`, `amount`, `dayOfMonth` (1–31), `bankId`, `userId`
- **Period** — `month` (1–12), `year`, `userId` — unique compound index on `(month, year, userId)`
- **Operation** — `label`, `amount`, `date`, `pointed` (bool), `bankId`, `periodId`, `userId`

Bank balances are computed client-side by summing `operation.amount` (negative = debit) grouped by `bankId`.

### Server (`server/`)

- **Entry:** `index.js` — Express 5, cors, express-session via connect-mongo, passport
- **Auth:** session-based with `passport-local`. `config/passport.js` defines the strategy; `middleware/requireAuth.js` guards all routes except `/api/auth/*`
- **Route pattern:** every route file exports a router; routes use `utils/asyncHandler.js` to forward async errors to Express. All queries include `{ userId: req.user._id }` as a scope filter
- **Import recurring:** `POST /api/operations/import-recurring` — idempotent, deduplicates by `label|bankId|amount` key before `insertMany`

### Client (`client/src/`)

- **Auth state:** `store/AuthContext.jsx` calls `GET /api/auth/me` on mount. `undefined` = loading (shows `<Spin fullscreen />`), `null` = unauthenticated
- **API layer:** `api/client.js` is an axios instance with `withCredentials: true`. Each resource has its own file (`api/banks.js`, etc.) returning `res.data` directly via a response interceptor
- **Routing:** `App.jsx` — `/login` (public) + `/*` behind `<PrivateRoute>`. The nested route layout renders `AppShell` (sidebar + header) with `<Outlet />`
- **Vite proxy:** `/api` → `http://localhost:3001`, so there are no CORS issues and the session cookie is first-party
- **Theme:** antd 6 `ConfigProvider` in `main.jsx` — primary color `#6366f1` (indigo), dark sider `#1e1e2e`. Token overrides are inline in `main.jsx`; `theme.js` is unused and can be removed

### Key behaviours

- A `Period` is created on demand (in `DashboardPage`) when the user adds an operation or imports recurring ops — no need to pre-create it
- Pointed operations are visually dimmed via `.op-pointed td { opacity: 0.5 }` inline style in `DashboardPage`
- `Space.Compact` from antd is used in `RecurringPage` modal — still present in antd 6

## Environment

Server reads `server/.env` (gitignored). Required variable:

```
MONGODB_URI=<mongodb+srv connection string>
PORT=3001          # optional, defaults to 3001
SESSION_SECRET=    # optional, defaults to 'dev_secret'
```

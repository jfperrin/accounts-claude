# User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to edit their profile (title, first name, last name, nickname, avatar) and display their nickname instead of username in the app header — in both the web client and the React Native mobile app.

**Architecture:** New fields are added to the User model (MongoDB + SQLite). A `PUT /api/auth/profile` route handles profile updates and a `POST /api/auth/avatar` route handles avatar upload via multer (stored at `server/uploads/avatars/`, served statically). Auth responses (`/me`, `/login`, `/register`) are updated to return all profile fields. The web client gets a `/profile` page reachable from the header avatar. The mobile app gets a fourth "Profil" bottom tab. Display name is `nickname || username` everywhere.

**Tech Stack:** Express 5, Mongoose, better-sqlite3, multer, React + React Router + Ant Design/shadcn, Expo SDK 55, expo-image-picker, expo-file-system, react-native-paper

---

## File Map

**Server:**
- Modify: `server/models/User.js` — add title, firstName, lastName, nickname, avatarUrl fields
- Modify: `server/db/sqlite.js` — extend mapUser, add ALTER TABLE columns, add users.updateProfile
- Modify: `server/db/mongo.js` — add users.updateProfile
- Create: `server/middleware/upload.js` — multer config for avatar (disk storage, 2 MB limit)
- Modify: `server/routes/auth.js` — update /me, add PUT /profile, POST /avatar
- Modify: `server/app.js` — serve /uploads statically

**Web client:**
- Create: `client/src/api/profile.js` — updateProfile(data), uploadAvatar(file)
- Modify: `client/src/store/AuthContext.jsx` — add updateUser(data) function
- Create: `client/src/pages/ProfilePage.jsx` — form with title/firstName/lastName/nickname + avatar upload
- Modify: `client/src/components/layout/AppShell.jsx` — show nickname, render AvatarImage, add profile link
- Modify: `client/src/App.jsx` — add /profile route

**Mobile:**
- Modify: `reactNative/src/types/index.ts` — extend User interface with new fields
- Modify: `reactNative/src/db/migrations.ts` — add new columns via ALTER TABLE (try-catch per column)
- Modify: `reactNative/src/db/repositories/auth.ts` — return new fields from all user queries
- Create: `reactNative/src/db/repositories/profile.ts` — updateProfile, updateAvatar (local SQLite)
- Create: `reactNative/src/api/profile.ts` — HTTP updateProfile + uploadAvatar
- Create: `reactNative/src/services/profile.ts` — dispatch IS_LOCAL → local repo or API
- Modify: `reactNative/src/store/AuthContext.tsx` — add updateUser(u: User) + expose updateProfile
- Create: `reactNative/src/screens/ProfileScreen.tsx` — profile edit screen
- Modify: `reactNative/src/navigation/types.ts` — add Profile to AppTabParamList
- Modify: `reactNative/src/navigation/AppNavigator.tsx` — add Profile tab
- Modify: `reactNative/src/screens/DashboardScreen.tsx` — show nickname in Appbar

---

## Task 1: Server — Extend User model and DB repositories

**Files:**
- Modify: `server/models/User.js`
- Modify: `server/db/sqlite.js`
- Modify: `server/db/mongo.js`

- [ ] **Step 1: Add profile fields to the Mongoose User model**

Replace the schema definition in `server/models/User.js`:

```javascript
const { Schema, model } = require('mongoose');

const schema = new Schema({
  username:     { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String },
  googleId:     { type: String, trim: true },
  email:        { type: String, trim: true },
  title:        { type: String, trim: true },
  firstName:    { type: String, trim: true },
  lastName:     { type: String, trim: true },
  nickname:     { type: String, trim: true },
  avatarUrl:    { type: String, trim: true },
}, { timestamps: true });

schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
```

- [ ] **Step 2: Extend mapUser in sqlite.js to include new fields**

Find `const mapUser = (row) => row && {` at line ~84 in `server/db/sqlite.js` and replace it:

```javascript
const mapUser = (row) => row && {
  _id:          row.id,
  username:     row.username,
  passwordHash: row.password_hash,
  googleId:     row.google_id,
  email:        row.email,
  title:        row.title ?? null,
  firstName:    row.first_name ?? null,
  lastName:     row.last_name ?? null,
  nickname:     row.nickname ?? null,
  avatarUrl:    row.avatar_url ?? null,
};
```

- [ ] **Step 3: Add ALTER TABLE migrations in initSchema (sqlite.js)**

Find the `db.exec(...)` call in `initSchema` and add at the very end, before the closing backtick, these idempotent ADD COLUMN statements. Since `better-sqlite3`'s `exec` runs multiple statements but SQLite errors on duplicate column, wrap each one separately after `initSchema`:

After the `db.exec(...)` call (line ~80 in `initSchema`), add:

```javascript
  // Profile columns — idempotent: silently ignored if already exist
  for (const col of [
    'ALTER TABLE users ADD COLUMN title      TEXT',
    'ALTER TABLE users ADD COLUMN first_name TEXT',
    'ALTER TABLE users ADD COLUMN last_name  TEXT',
    'ALTER TABLE users ADD COLUMN nickname   TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }
```

- [ ] **Step 4: Add updateProfile to sqlite.js users repo**

Inside the `const users = {` block in `server/db/sqlite.js`, after the `usernameExists` method, add:

```javascript
    updateProfile(id, { title, firstName, lastName, nickname }) {
      db.prepare(
        `UPDATE users SET title=?, first_name=?, last_name=?, nickname=?, updated_at=datetime('now') WHERE id=?`
      ).run(title ?? null, firstName ?? null, lastName ?? null, nickname ?? null, uid(id));
      return this.findById(id);
    },

    updateAvatar(id, avatarUrl) {
      db.prepare(`UPDATE users SET avatar_url=?, updated_at=datetime('now') WHERE id=?`)
        .run(avatarUrl, uid(id));
      return this.findById(id);
    },
```

Also update `findById` to include the new columns in its SELECT (so it returns them):

```javascript
    findById: (id) =>
      mapUser(db.prepare('SELECT id, username, email, google_id, title, first_name, last_name, nickname, avatar_url FROM users WHERE id = ?').get(id)),
```

- [ ] **Step 5: Add updateProfile to mongo.js users repo**

In `server/db/mongo.js`, inside the `const users = {` block, add after `usernameExists`:

```javascript
  updateProfile: (id, data) =>
    User.findByIdAndUpdate(id, { $set: data }, { new: true }).select('-passwordHash'),

  updateAvatar: (id, avatarUrl) =>
    User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { new: true }).select('-passwordHash'),
```

- [ ] **Step 6: Commit**

```bash
git add server/models/User.js server/db/sqlite.js server/db/mongo.js
git commit -m "feat(server): add profile fields to User model (title, firstName, lastName, nickname, avatarUrl)"
```

---

## Task 2: Server — Avatar upload middleware + profile routes

**Files:**
- Create: `server/middleware/upload.js`
- Modify: `server/routes/auth.js`
- Modify: `server/app.js`

- [ ] **Step 1: Install multer**

```bash
cd server && yarn add multer
```

Expected: multer appears in `server/package.json` dependencies.

- [ ] **Step 2: Create multer upload middleware**

Create `server/middleware/upload.js`:

```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, _file, cb) => cb(null, `${req.user._id}_${Date.now()}.jpg`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Seules les images sont acceptées'));
    }
    cb(null, true);
  },
});

module.exports = upload;
```

- [ ] **Step 3: Add profile routes to auth.js**

Add a helper at the top of `server/routes/auth.js` (after `const wrap = require(...)`) and two new routes before `module.exports`:

```javascript
const requireAuth = require('../middleware/requireAuth');
const upload = require('../middleware/upload');

// Helper : sérialise un user Mongoose ou SQLite en réponse JSON uniforme
function serializeUser(u) {
  return {
    _id:       u._id ?? u.id,
    username:  u.username,
    title:     u.title     ?? null,
    firstName: u.firstName ?? null,
    lastName:  u.lastName  ?? null,
    nickname:  u.nickname  ?? null,
    avatarUrl: u.avatarUrl ?? null,
  };
}
```

Update the existing `/me`, `/login`, `/register` responses to use `serializeUser`:

- In `/register` (line ~33): `res.json(serializeUser(user));`
- In `/login` (line ~47): `res.json(serializeUser(user));`
- In `/me` (line ~83): `res.json(serializeUser(req.user));`

Add new routes before `module.exports = router;`:

```javascript
// PUT /api/auth/profile — met à jour les champs de profil de l'utilisateur connecté
router.put('/profile', requireAuth, wrap(async (req, res) => {
  const { title, firstName, lastName, nickname } = req.body;
  const db = req.app.locals.db;
  const updated = await db.users.updateProfile(req.user._id, { title, firstName, lastName, nickname });
  res.json(serializeUser(updated));
}));

// POST /api/auth/avatar — upload de l'avatar (multipart/form-data, champ "avatar")
router.post('/avatar', requireAuth, upload.single('avatar'), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' });
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  const db = req.app.locals.db;
  const updated = await db.users.updateAvatar(req.user._id, avatarUrl);
  res.json(serializeUser(updated));
}));
```

- [ ] **Step 4: Serve uploads directory statically in app.js**

In `server/app.js`, add after `app.use(express.json())`:

```javascript
  // Sert les avatars uploadés
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

- [ ] **Step 5: Commit**

```bash
git add server/middleware/upload.js server/routes/auth.js server/app.js server/package.json server/yarn.lock
git commit -m "feat(server): add PUT /api/auth/profile and POST /api/auth/avatar routes"
```

---

## Task 3: Web client — Profile API + AuthContext update

**Files:**
- Create: `client/src/api/profile.js`
- Modify: `client/src/store/AuthContext.jsx`

- [ ] **Step 1: Create profile API module**

Create `client/src/api/profile.js`:

```javascript
import client from './client';

export const updateProfile = (data) => client.put('/auth/profile', data);

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('avatar', file);
  return client.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
```

- [ ] **Step 2: Add updateUser to AuthContext**

Replace the content of `client/src/store/AuthContext.jsx`:

```javascript
import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  const login = async (credentials) => {
    const u = await authApi.login(credentials);
    setUser(u);
    return u;
  };

  const register = async (credentials) => {
    const u = await authApi.register(credentials);
    setUser(u);
    return u;
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const updateUser = (u) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api/profile.js client/src/store/AuthContext.jsx
git commit -m "feat(client): add profile API module and updateUser to AuthContext"
```

---

## Task 4: Web client — ProfilePage + AppShell + routing

**Files:**
- Create: `client/src/pages/ProfilePage.jsx`
- Modify: `client/src/components/layout/AppShell.jsx`
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Create ProfilePage**

Create `client/src/pages/ProfilePage.jsx`:

```javascript
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import * as profileApi from '@/api/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TITLES = ['M.', 'Mme', 'Dr', 'Pr'];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title:     user?.title     ?? '',
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    nickname:  user?.nickname  ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await profileApi.updateProfile(form);
      updateUser(updated);
      toast.success('Profil enregistré');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await profileApi.uploadAvatar(file);
      updateUser(updated);
      toast.success('Avatar mis à jour');
    } catch (err) {
      toast.error(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const displayName = user?.nickname || user?.username;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ? `http://localhost:3001${user.avatarUrl}` : undefined;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-xl font-extrabold text-foreground">Mon profil</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-4">
        <Avatar className="h-24 w-24 text-2xl">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onAvatarChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Envoi…' : 'Changer l\'avatar'}
        </Button>
      </div>

      {/* Form */}
      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label>Titre</Label>
          <Select value={form.title} onValueChange={set('title')}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">—</SelectItem>
              {TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Prénom</Label>
            <Input id="firstName" value={form.firstName} onChange={set('firstName')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nom</Label>
            <Input id="lastName" value={form.lastName} onChange={set('lastName')} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nickname">Surnom (affiché en haut)</Label>
          <Input id="nickname" value={form.nickname} onChange={set('nickname')} placeholder={user?.username} />
        </div>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Update AppShell to show nickname + avatar + profile link**

Replace the content of `client/src/components/layout/AppShell.jsx`:

```javascript
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, RefreshCw, LogOut, ChevronLeft, ChevronRight, Wallet, UserCircle } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { key: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { key: '/banks', icon: Building2, label: 'Banques' },
  { key: '/recurring', icon: RefreshCw, label: 'Opérations récurrentes' },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const displayName = user?.nickname || user?.username;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ? `http://localhost:3001${user.avatarUrl}` : undefined;

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          'flex flex-col bg-sidebar text-white transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className={cn(
          'flex items-center gap-3 border-b border-white/10 py-4',
          collapsed ? 'justify-center px-0' : 'px-5'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight">Comptes</span>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV_ITEMS.map(({ key, icon: Icon, label }) => (
            <button
              type="button"
              key={key}
              onClick={() => navigate(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-card px-6 shadow-xs">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-accent transition-colors"
            title="Mon profil"
          >
            <Avatar className="h-8 w-8">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={displayName} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-semibold text-foreground">{displayName}</span>
          </button>
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground gap-1.5">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add /profile route in App.jsx**

In `client/src/App.jsx`, add the ProfilePage import and route:

```javascript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';
import ProfilePage from '@/pages/ProfilePage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/ProfilePage.jsx client/src/components/layout/AppShell.jsx client/src/App.jsx
git commit -m "feat(client): add ProfilePage with avatar upload, show nickname in header"
```

---

## Task 5: Mobile — Types + SQLite migration + local repositories

**Files:**
- Modify: `reactNative/src/types/index.ts`
- Modify: `reactNative/src/db/migrations.ts`
- Modify: `reactNative/src/db/repositories/auth.ts`
- Create: `reactNative/src/db/repositories/profile.ts`

- [ ] **Step 1: Install expo-image-picker and expo-file-system**

```bash
cd reactNative && npx expo install expo-image-picker expo-file-system
```

Expected: both packages appear in `reactNative/package.json`.

- [ ] **Step 2: Extend User interface**

Replace the User interface in `reactNative/src/types/index.ts`:

```typescript
/** Utilisateur authentifié. */
export interface User {
  _id:       string;
  username:  string;
  title:     string | null;
  firstName: string | null;
  lastName:  string | null;
  nickname:  string | null;
  avatarUrl: string | null;
}
```

- [ ] **Step 3: Add migration for new user columns**

Replace the content of `reactNative/src/db/migrations.ts`:

```typescript
import type { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banks (
      id      TEXT PRIMARY KEY,
      label   TEXT NOT NULL,
      user_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS periods (
      id       TEXT PRIMARY KEY,
      month    INTEGER NOT NULL,
      year     INTEGER NOT NULL,
      balances TEXT NOT NULL DEFAULT '{}',
      user_id  TEXT NOT NULL,
      UNIQUE(month, year, user_id)
    );

    CREATE TABLE IF NOT EXISTS operations (
      id        TEXT PRIMARY KEY,
      label     TEXT NOT NULL,
      amount    REAL NOT NULL,
      date      TEXT NOT NULL,
      pointed   INTEGER NOT NULL DEFAULT 0,
      bank_id   TEXT NOT NULL,
      period_id TEXT NOT NULL,
      user_id   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_operations (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      amount       REAL NOT NULL,
      day_of_month INTEGER NOT NULL,
      bank_id      TEXT NOT NULL,
      user_id      TEXT NOT NULL
    );
  `);

  // Profile columns — idempotent: silently ignored if column already exists
  const profileColumns: [string, string][] = [
    ['title',      'TEXT'],
    ['first_name', 'TEXT'],
    ['last_name',  'TEXT'],
    ['nickname',   'TEXT'],
    ['avatar_url', 'TEXT'],
  ];
  for (const [col, type] of profileColumns) {
    try {
      await db.runAsync(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    } catch (_) {
      // column already exists — safe to ignore
    }
  }
}
```

- [ ] **Step 4: Update auth repository to return new fields**

Replace the content of `reactNative/src/db/repositories/auth.ts`:

```typescript
import bcrypt from 'bcryptjs';
import * as SecureStore from 'expo-secure-store';
import { getDb, generateId } from '@/db/client';
import type { User, AuthCredentials } from '@/types';

const SESSION_KEY = 'local_user_id';

interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

function mapUser(row: DbUser): User {
  return {
    _id:       row.id,
    username:  row.username,
    title:     row.title      ?? null,
    firstName: row.first_name ?? null,
    lastName:  row.last_name  ?? null,
    nickname:  row.nickname   ?? null,
    avatarUrl: row.avatar_url ?? null,
  };
}

export async function register({ username, password }: AuthCredentials): Promise<User> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DbUser>(
    'SELECT id FROM users WHERE username = ?', [username]
  );
  if (existing) throw new Error('Username already taken');

  const id   = generateId();
  const hash = await bcrypt.hash(password, 10);
  await db.runAsync(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    [id, username, hash]
  );
  await SecureStore.setItemAsync(SESSION_KEY, id);
  return { _id: id, username, title: null, firstName: null, lastName: null, nickname: null, avatarUrl: null };
}

export async function login({ username, password }: AuthCredentials): Promise<User> {
  const db   = await getDb();
  const user = await db.getFirstAsync<DbUser>(
    'SELECT * FROM users WHERE username = ?', [username]
  );
  if (!user) throw new Error('Invalid credentials');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error('Invalid credentials');

  await SecureStore.setItemAsync(SESSION_KEY, user.id);
  return mapUser(user);
}

export async function me(): Promise<User | null> {
  const id = await SecureStore.getItemAsync(SESSION_KEY);
  if (!id) return null;
  const db   = await getDb();
  const user = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) return null;
  return mapUser(user);
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
```

- [ ] **Step 5: Create local profile repository**

Create `reactNative/src/db/repositories/profile.ts`:

```typescript
import * as FileSystem from 'expo-file-system';
import { getDb } from '@/db/client';
import type { User } from '@/types';

interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

function mapUser(row: DbUser): User {
  return {
    _id:       row.id,
    username:  row.username,
    title:     row.title      ?? null,
    firstName: row.first_name ?? null,
    lastName:  row.last_name  ?? null,
    nickname:  row.nickname   ?? null,
    avatarUrl: row.avatar_url ?? null,
  };
}

export async function updateProfile(
  userId: string,
  data: { title: string | null; firstName: string | null; lastName: string | null; nickname: string | null }
): Promise<User> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE users SET title=?, first_name=?, last_name=?, nickname=? WHERE id=?',
    [data.title, data.firstName, data.lastName, data.nickname, userId]
  );
  const row = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id=?', [userId]);
  if (!row) throw new Error('User not found');
  return mapUser(row);
}

export async function updateAvatar(userId: string, imageUri: string): Promise<User> {
  const dest = `${FileSystem.documentDirectory}avatars/${userId}.jpg`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}avatars`, { intermediates: true });
  await FileSystem.copyAsync({ from: imageUri, to: dest });

  const db = await getDb();
  await db.runAsync('UPDATE users SET avatar_url=? WHERE id=?', [dest, userId]);
  const row = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id=?', [userId]);
  if (!row) throw new Error('User not found');
  return mapUser(row);
}
```

- [ ] **Step 6: Commit**

```bash
git add reactNative/src/types/index.ts reactNative/src/db/migrations.ts \
        reactNative/src/db/repositories/auth.ts reactNative/src/db/repositories/profile.ts \
        reactNative/package.json
git commit -m "feat(mobile): extend User type, add profile columns migration and local profile repository"
```

---

## Task 6: Mobile — Profile service + API + AuthContext

**Files:**
- Create: `reactNative/src/api/profile.ts`
- Create: `reactNative/src/services/profile.ts`
- Modify: `reactNative/src/store/AuthContext.tsx`

- [ ] **Step 1: Create HTTP profile API**

Create `reactNative/src/api/profile.ts`:

```typescript
import apiClient from './client';
import type { User } from '@/types';

export function updateProfile(data: {
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
}): Promise<User> {
  return apiClient.put('/auth/profile', data);
}

export function uploadAvatar(imageUri: string): Promise<User> {
  const form = new FormData();
  form.append('avatar', {
    uri:  imageUri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  return apiClient.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}
```

- [ ] **Step 2: Create profile service**

Create `reactNative/src/services/profile.ts`:

```typescript
import { IS_LOCAL } from './index';
import * as localProfile from '@/db/repositories/profile';
import * as apiProfile   from '@/api/profile';
import type { User } from '@/types';

export function updateProfile(
  userId: string,
  data: { title: string | null; firstName: string | null; lastName: string | null; nickname: string | null }
): Promise<User> {
  if (IS_LOCAL) return localProfile.updateProfile(userId, data);
  return apiProfile.updateProfile(data);
}

export function updateAvatar(userId: string, imageUri: string): Promise<User> {
  if (IS_LOCAL) return localProfile.updateAvatar(userId, imageUri);
  return apiProfile.uploadAvatar(imageUri);
}
```

- [ ] **Step 3: Add updateUser to mobile AuthContext**

Replace `reactNative/src/store/AuthContext.tsx`:

```typescript
/**
 * Contexte d'authentification global.
 *
 * - `user === undefined`  → chargement initial (affiche un spinner)
 * - `user === null`       → non authentifié (redirige vers /login)
 * - `user === User`       → authentifié
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '@/services/auth';
import type { User, AuthCredentials } from '@/types';

interface AuthContextValue {
  user: User | null | undefined;
  login: (c: AuthCredentials) => Promise<void>;
  register: (c: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    authService.me().then(setUser).catch(() => setUser(null));
  }, []);

  const login = async (credentials: AuthCredentials) => {
    const u = await authService.login(credentials);
    setUser(u);
  };

  const register = async (credentials: AuthCredentials) => {
    const u = await authService.register(credentials);
    setUser(u);
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const updateUser = (u: User) => setUser(u);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Commit**

```bash
git add reactNative/src/api/profile.ts reactNative/src/services/profile.ts reactNative/src/store/AuthContext.tsx
git commit -m "feat(mobile): add profile service, HTTP API, and updateUser to AuthContext"
```

---

## Task 7: Mobile — ProfileScreen + navigation + DashboardScreen header

**Files:**
- Create: `reactNative/src/screens/ProfileScreen.tsx`
- Modify: `reactNative/src/navigation/types.ts`
- Modify: `reactNative/src/navigation/AppNavigator.tsx`
- Modify: `reactNative/src/screens/DashboardScreen.tsx`

- [ ] **Step 1: Create ProfileScreen**

Create `reactNative/src/screens/ProfileScreen.tsx`:

```typescript
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar, TextInput, Button, Avatar, Text } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useAuthContext } from '@/store/AuthContext';
import * as profileService from '@/services/profile';
import { palette } from '@/theme';

const TITLES = ['', 'M.', 'Mme', 'Dr', 'Pr'];

export function ProfileScreen() {
  const { user, updateUser } = useAuthContext();

  const [title,     setTitle]     = useState(user?.title     ?? '');
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName,  setLastName]  = useState(user?.lastName  ?? '');
  const [nickname,  setNickname]  = useState(user?.nickname  ?? '');
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');

  const displayName = user?.nickname || user?.username || '';
  const initials    = displayName.slice(0, 2).toUpperCase();

  const onSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await profileService.updateProfile(user!._id, {
        title:     title     || null,
        firstName: firstName || null,
        lastName:  lastName  || null,
        nickname:  nickname  || null,
      });
      updateUser(updated);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission requise pour accéder à la galerie');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploading(true);
    setError('');
    try {
      const updated = await profileService.updateAvatar(user!._id, result.assets[0].uri);
      updateUser(updated);
    } catch (e: any) {
      setError(e.message || 'Erreur upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title="Mon profil" titleStyle={styles.appbarTitle} />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {user?.avatarUrl ? (
            <Avatar.Image size={96} source={{ uri: user.avatarUrl }} />
          ) : (
            <Avatar.Text size={96} label={initials} style={{ backgroundColor: palette.indigo500 }} />
          )}
          <Button
            mode="outlined"
            onPress={onPickAvatar}
            loading={uploading}
            disabled={uploading}
            style={styles.avatarBtn}
          >
            Changer l'avatar
          </Button>
        </View>

        {/* Title picker */}
        <Text variant="labelMedium" style={styles.label}>Titre</Text>
        <View style={styles.titleRow}>
          {TITLES.map((t) => (
            <Button
              key={t || 'none'}
              mode={title === t ? 'contained' : 'outlined'}
              onPress={() => setTitle(t)}
              style={styles.titleBtn}
              compact
            >
              {t || '—'}
            </Button>
          ))}
        </View>

        <TextInput
          label="Prénom"
          value={firstName}
          onChangeText={setFirstName}
          style={styles.input}
          mode="outlined"
          autoCapitalize="words"
        />
        <TextInput
          label="Nom"
          value={lastName}
          onChangeText={setLastName}
          style={styles.input}
          mode="outlined"
          autoCapitalize="words"
        />
        <TextInput
          label="Surnom (affiché en haut)"
          value={nickname}
          onChangeText={setNickname}
          style={styles.input}
          mode="outlined"
          placeholder={user?.username}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          onPress={onSave}
          loading={saving}
          disabled={saving}
          style={styles.saveBtn}
        >
          Enregistrer
        </Button>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  appbar:      { backgroundColor: palette.indigo600 ?? '#4f46e5' },
  appbarTitle: { color: '#fff', fontWeight: '700' },
  container:   { padding: 20, gap: 8 },
  avatarSection: { alignItems: 'center', marginBottom: 16, gap: 12 },
  avatarBtn:   { marginTop: 4 },
  label:       { marginTop: 8, marginBottom: 4, color: '#64748b' },
  titleRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  titleBtn:    { minWidth: 56 },
  input:       { marginBottom: 12, backgroundColor: '#fff' },
  error:       { color: '#e11d48', marginBottom: 8 },
  saveBtn:     { marginTop: 8 },
});
```

- [ ] **Step 2: Add Profile to navigation types**

Replace `reactNative/src/navigation/types.ts`:

```typescript
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type AuthStackParamList = {
  Login: undefined;
};

export type AppTabParamList = {
  Dashboard: undefined;
  Banks:     undefined;
  Recurring: undefined;
  Profile:   undefined;
};

export type AuthStackProps<S extends keyof AuthStackParamList> =
  NativeStackScreenProps<AuthStackParamList, S>;

export type AppTabProps<S extends keyof AppTabParamList> =
  BottomTabScreenProps<AppTabParamList, S>;
```

- [ ] **Step 3: Add Profile tab to AppNavigator**

Replace `reactNative/src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { DashboardScreen } from '@/screens/DashboardScreen';
import { BanksScreen }     from '@/screens/BanksScreen';
import { RecurringScreen } from '@/screens/RecurringScreen';
import { ProfileScreen }   from '@/screens/ProfileScreen';
import type { AppTabParamList } from './types';
import { palette } from '@/theme';

const Tab = createBottomTabNavigator<AppTabParamList>();

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: Array<{
  name: keyof AppTabParamList;
  label: string;
  icon: IconName;
  iconFocused: IconName;
  component: React.ComponentType<any>;
}> = [
  { name: 'Dashboard', label: 'Tableau de bord', icon: 'view-dashboard-outline', iconFocused: 'view-dashboard',   component: DashboardScreen },
  { name: 'Banks',     label: 'Banques',         icon: 'bank-outline',           iconFocused: 'bank',             component: BanksScreen },
  { name: 'Recurring', label: 'Récurrents',      icon: 'repeat',                 iconFocused: 'repeat',           component: RecurringScreen },
  { name: 'Profile',   label: 'Profil',          icon: 'account-outline',        iconFocused: 'account',          component: ProfileScreen },
];

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = TABS.find((t) => t.name === route.name)!;
        return {
          headerShown:             false,
          tabBarActiveTintColor:   palette.indigo500,
          tabBarInactiveTintColor: palette.gray400,
          tabBarStyle: {
            backgroundColor: palette.white,
            borderTopColor:  palette.gray200,
            paddingBottom:   4,
            height:          60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIcon: ({ focused, color, size }) => (
            <MaterialCommunityIcons
              name={focused ? tab.iconFocused : tab.icon}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      {TABS.map((t) => (
        <Tab.Screen
          key={t.name}
          name={t.name}
          component={t.component}
          options={{ tabBarLabel: t.label }}
        />
      ))}
    </Tab.Navigator>
  );
}
```

- [ ] **Step 4: Update DashboardScreen to show nickname**

In `reactNative/src/screens/DashboardScreen.tsx`, replace the `<Appbar.Header>` block (lines ~98–101):

```typescript
  const displayName = user?.nickname || user?.username || 'Tableau de bord';

  return (
    <>
      <Appbar.Header style={styles.appbar}>
        <Appbar.Content title={displayName} titleStyle={styles.appbarTitle} />
        <Appbar.Action icon="logout" onPress={logout} />
      </Appbar.Header>
```

- [ ] **Step 5: Commit**

```bash
git add reactNative/src/screens/ProfileScreen.tsx \
        reactNative/src/navigation/types.ts \
        reactNative/src/navigation/AppNavigator.tsx \
        reactNative/src/screens/DashboardScreen.tsx
git commit -m "feat(mobile): add ProfileScreen with avatar picker, Profile tab, show nickname in dashboard header"
```

---

## Self-Review

### Spec Coverage

| Requirement | Covered |
|---|---|
| Edit title | ✅ Task 4 (web), Task 7 (mobile) |
| Edit first name | ✅ Task 4 (web), Task 7 (mobile) |
| Edit last name | ✅ Task 4 (web), Task 7 (mobile) |
| Edit nickname | ✅ Task 4 (web), Task 7 (mobile) |
| Upload avatar | ✅ Task 2 + 4 (web), Task 5 + 7 (mobile) |
| Show nickname in header (web) | ✅ Task 4 — `displayName = nickname \|\| username` |
| Show nickname in header (mobile) | ✅ Task 7 — DashboardScreen Appbar title |
| Persisted to MongoDB | ✅ Task 1 — Mongoose model + mongo.js updateProfile |
| Persisted to SQLite (server dev) | ✅ Task 1 — sqlite.js ALTER + updateProfile |
| Persisted to SQLite (mobile local) | ✅ Task 5 — migrations + profile repo |
| API mode mobile | ✅ Task 6 — api/profile.ts + service dispatch |

### Placeholder Scan

No TBD, TODO, or vague steps found.

### Type Consistency

- `User` interface fields: `_id, username, title, firstName, lastName, nickname, avatarUrl` — consistent across `types/index.ts`, `auth.ts` mapUser, `profile.ts` mapUser, API responses.
- `profileService.updateProfile(userId, data)` — signature consistent in service and both repository implementations.
- `updateUser(u: User)` — consistent in AuthContext interface and all call sites in ProfileScreen.

# Email comme identifiant unique — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer `username` par `email` comme seul identifiant de connexion côté serveur (SQLite + Mongo) et côté client web.

**Architecture:** Suppression du champ `username` dans les deux backends (SQLite et Mongoose) ; `email` devient `NOT NULL UNIQUE` et est utilisé par Passport comme `usernameField`. Une nouvelle route `PUT /api/auth/email` permet à un utilisateur de changer son email avec vérification de doublon. L'admin ne gère plus que email + rôle.

**Tech Stack:** Node.js / Express 5 / better-sqlite3 / Mongoose / Passport-local / React / Vite / Vitest / @testing-library/react

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `server/models/User.js` | Modifier |
| `server/db/sqlite.js` | Modifier |
| `server/db/mongo.js` | Modifier |
| `server/config/passport.js` | Modifier |
| `server/utils/ensureAdmin.js` | Modifier |
| `server/routes/auth.js` | Modifier |
| `server/routes/admin.js` | Modifier |
| `client/src/api/profile.js` | Modifier |
| `client/src/pages/LoginPage.jsx` | Modifier |
| `client/src/tests/LoginPage.test.jsx` | Modifier |
| `client/src/components/layout/AppShell.jsx` | Modifier |
| `client/src/pages/ProfilePage.jsx` | Modifier |
| `client/src/components/admin/UserFormModal.jsx` | Modifier |

---

## Task 1 : SQLite — schéma et méthodes repo

**Files:**
- Modify: `server/db/sqlite.js`

- [ ] **Step 1 : Mettre à jour `initSchema` — supprimer `username`, rendre `email` NOT NULL UNIQUE**

Dans `initSchema`, remplacer la définition de la table `users` :

```js
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_id   TEXT UNIQUE,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );
  /* ... reste des tables inchangées ... */
`);
```

Remplacer aussi le bloc `ALTER TABLE` d'idempotence pour `role` et `email` — supprimer la ligne `ALTER TABLE users ADD COLUMN email TEXT` (email est maintenant dans le CREATE) et garder uniquement :

```js
for (const col of [
  "ALTER TABLE users ADD COLUMN role  TEXT NOT NULL DEFAULT 'user'",
  'ALTER TABLE users ADD COLUMN title      TEXT',
  'ALTER TABLE users ADD COLUMN first_name TEXT',
  'ALTER TABLE users ADD COLUMN last_name  TEXT',
  'ALTER TABLE users ADD COLUMN nickname   TEXT',
  'ALTER TABLE users ADD COLUMN avatar_url TEXT',
]) {
  try { db.exec(col); } catch (_) { /* column already exists */ }
}
```

- [ ] **Step 2 : Mettre à jour `mapUser` — supprimer `username`**

```js
const mapUser = (row) => row && {
  _id:          row.id,
  passwordHash: row.password_hash,
  googleId:     row.google_id,
  email:        row.email ?? null,
  role:         row.role ?? 'user',
  title:        row.title ?? null,
  firstName:    row.first_name ?? null,
  lastName:     row.last_name ?? null,
  nickname:     row.nickname ?? null,
  avatarUrl:    row.avatar_url ?? null,
};
```

- [ ] **Step 3 : Mettre à jour les méthodes du repo `users`**

Remplacer l'intégralité du bloc `users` :

```js
const users = {
  findByEmail: (email) =>
    mapUser(db.prepare('SELECT * FROM users WHERE email = ?').get(email)),

  findByGoogleId: (googleId) =>
    mapUser(db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId)),

  findById: (id) =>
    mapUser(db.prepare('SELECT id, email, role, google_id, title, first_name, last_name, nickname, avatar_url FROM users WHERE id = ?').get(id)),

  findByIdWithHash: (id) =>
    mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)),

  create({ email, passwordHash, googleId, role }) {
    const id = randomUUID();
    db.prepare(
      'INSERT INTO users (id, email, password_hash, google_id, role) VALUES (?, ?, ?, ?, ?)',
    ).run(id, email, passwordHash ?? null, googleId ?? null, role ?? 'user');
    return this.findById(id);
  },

  emailExists: (email) =>
    !!db.prepare('SELECT 1 FROM users WHERE email = ?').get(email),

  updateProfile(id, { title, firstName, lastName, nickname }) {
    db.prepare(
      `UPDATE users SET title=?, first_name=?, last_name=?, nickname=?, updated_at=datetime('now') WHERE id=?`
    ).run(title ?? null, firstName ?? null, lastName ?? null, nickname ?? null, uid(id));
    return this.findById(id);
  },

  updateEmail(id, email) {
    db.prepare(`UPDATE users SET email=?, updated_at=datetime('now') WHERE id=?`)
      .run(email, uid(id));
    return this.findById(id);
  },

  updateAvatar(id, avatarUrl) {
    db.prepare(`UPDATE users SET avatar_url=?, updated_at=datetime('now') WHERE id=?`)
      .run(avatarUrl ?? null, uid(id));
    return this.findById(id);
  },

  findAll() {
    return db.prepare(
      'SELECT id, email, role, title, first_name, last_name, nickname, avatar_url, created_at FROM users ORDER BY created_at DESC',
    ).all().map(mapUser);
  },

  updateByAdmin(id, { email, role }) {
    db.prepare(
      `UPDATE users SET email=?, role=?, updated_at=datetime('now') WHERE id=?`,
    ).run(email ?? null, role ?? 'user', uid(id));
    return this.findById(id);
  },

  deleteUser(id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(uid(id));
  },

  setPassword(id, passwordHash) {
    db.prepare(
      `UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`
    ).run(passwordHash, uid(id));
  },
};
```

- [ ] **Step 4 : Vérifier manuellement le démarrage du serveur**

```bash
yarn --cwd server dev
```

Attendu : `SQLite connected: .../dev.db` sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add server/db/sqlite.js
git commit -m "feat(server): replace username with email as unique identifier in SQLite"
```

---

## Task 2 : Mongoose User model + mongo repo

**Files:**
- Modify: `server/models/User.js`
- Modify: `server/db/mongo.js`

- [ ] **Step 1 : Mettre à jour le modèle Mongoose**

Remplacer le contenu de `server/models/User.js` :

```js
const { Schema, model } = require('mongoose');

const schema = new Schema({
  passwordHash: { type: String },
  googleId:     { type: String, trim: true },
  email:        { type: String, required: true, unique: true, trim: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  title:        { type: String, trim: true },
  firstName:    { type: String, trim: true },
  lastName:     { type: String, trim: true },
  nickname:     { type: String, trim: true },
  avatarUrl:    { type: String, trim: true },
}, { timestamps: true });

schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
```

- [ ] **Step 2 : Mettre à jour `db/mongo.js` — repo users**

Remplacer le bloc `users` :

```js
const users = {
  findByEmail: (email) => User.findOne({ email }),
  findByGoogleId: (googleId) => User.findOne({ googleId }),
  findById: (id) => User.findById(id).select('-passwordHash'),
  findByIdWithHash: (id) => User.findById(id),
  create: (data) => User.create(data),
  emailExists: async (email) => !!(await User.findOne({ email })),

  updateProfile: (id, { title, firstName, lastName, nickname }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { title, firstName, lastName, nickname } },
      { new: true },
    ).select('-passwordHash'),

  updateEmail: (id, email) =>
    User.findByIdAndUpdate(id, { $set: { email } }, { new: true }).select('-passwordHash'),

  updateAvatar: (id, avatarUrl) =>
    User.findByIdAndUpdate(id, { $set: { avatarUrl } }, { new: true }).select('-passwordHash'),

  findAll: () =>
    User.find({}).select('-passwordHash').sort({ createdAt: -1 }),

  updateByAdmin: (id, { email, role }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { email, role } },
      { new: true },
    ).select('-passwordHash'),

  deleteUser: (id) => User.findByIdAndDelete(id),

  setPassword: (id, passwordHash) =>
    User.findByIdAndUpdate(id, { $set: { passwordHash } }, { new: true }).select('-passwordHash'),
};
```

- [ ] **Step 3 : Commit**

```bash
git add server/models/User.js server/db/mongo.js
git commit -m "feat(server): replace username with email in Mongoose model and mongo repo"
```

---

## Task 3 : Passport + ensureAdmin

**Files:**
- Modify: `server/config/passport.js`
- Modify: `server/utils/ensureAdmin.js`

- [ ] **Step 1 : Mettre à jour la LocalStrategy dans `passport.js`**

Remplacer le bloc de la stratégie locale :

```js
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await db.users.findByEmail(email);
    if (!user) return done(null, false, { message: 'Utilisateur introuvable' });
    if (!user.passwordHash) return done(null, false, { message: 'Ce compte utilise la connexion Google' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return done(null, false, { message: 'Mot de passe incorrect' });
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));
```

Mettre à jour le flow Google pour ne plus générer de `username` :

```js
// Dans la GoogleStrategy, remplacer le bloc "Nouvel utilisateur Google" :
user = await db.users.create({ googleId: profile.id, email });
done(null, user);
```

Supprimer les lignes `usernameExists` et la génération de `username` dans le flow Google.

- [ ] **Step 2 : Mettre à jour `ensureAdmin.js`**

```js
const bcrypt = require('bcryptjs');

module.exports = async function ensureAdmin(db) {
  const { ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
  if (!ADMIN_PASSWORD || !ADMIN_EMAIL) return;

  const existing = await db.users.findByEmail(ADMIN_EMAIL);
  if (existing) {
    if (existing.role !== 'admin') {
      await db.users.updateByAdmin(existing._id, {
        email: existing.email,
        role: 'admin',
      });
    }
    console.log(`[admin] Compte admin "${ADMIN_EMAIL}" prêt.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.users.create({
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
  });
  console.log(`[admin] Compte admin "${ADMIN_EMAIL}" créé.`);
};
```

- [ ] **Step 3 : Commit**

```bash
git add server/config/passport.js server/utils/ensureAdmin.js
git commit -m "feat(server): use email field in Passport LocalStrategy and ensureAdmin"
```

---

## Task 4 : Routes auth — register, serializeUser, PUT /email

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1 : Mettre à jour `serializeUser`**

```js
function serializeUser(u) {
  return {
    _id:       u._id ?? u.id,
    email:     u.email ?? null,
    role:      u.role ?? 'user',
    title:     u.title     ?? null,
    firstName: u.firstName ?? null,
    lastName:  u.lastName  ?? null,
    nickname:  u.nickname  ?? null,
    avatarUrl: u.avatarUrl ?? null,
  };
}
```

- [ ] **Step 2 : Mettre à jour `POST /register`**

```js
router.post('/register', authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Champs requis' });
  const db = req.app.locals.db;
  if (await db.users.emailExists(email)) return res.status(409).json({ message: 'Email déjà utilisé' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email, passwordHash });
  req.login(user, (err) => {
    if (err) return res.status(500).json({ message: 'Erreur session' });
    res.json(serializeUser(user));
  });
}));
```

- [ ] **Step 3 : Ajouter `PUT /email`**

Ajouter après la route `PUT /profile` :

```js
// PUT /api/auth/email — change l'email de l'utilisateur connecté
router.put('/email', requireAuth, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email requis' });
  const db = req.app.locals.db;
  const selfId = String(req.user._id ?? req.user.id);
  // Vérifier le doublon uniquement sur les autres utilisateurs
  const existing = await db.users.findByEmail(email);
  if (existing && String(existing._id ?? existing.id) !== selfId) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  const updated = await db.users.updateEmail(selfId, email);
  res.json(serializeUser(updated));
}));
```

- [ ] **Step 4 : Tester manuellement les routes**

Démarrer le serveur (`yarn --cwd server dev`) et vérifier :
- `POST /api/auth/register` avec `{ email, password }` → 200 avec objet user contenant `email`
- `POST /api/auth/login` avec `{ email, password }` → 200
- `PUT /api/auth/email` (authentifié) avec `{ email: "new@test.com" }` → 200
- `PUT /api/auth/email` avec un email déjà pris → 409

- [ ] **Step 5 : Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(server): update auth routes to use email as identifier, add PUT /email"
```

---

## Task 5 : Routes admin

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1 : Mettre à jour `serializeAdminUser`**

```js
function serializeAdminUser(u) {
  return {
    _id:       u._id ?? u.id,
    email:     u.email ?? null,
    role:      u.role ?? 'user',
    firstName: u.firstName ?? null,
    lastName:  u.lastName ?? null,
    nickname:  u.nickname ?? null,
    createdAt: u.createdAt ?? null,
  };
}
```

- [ ] **Step 2 : Mettre à jour `POST /users`**

```js
router.post('/users', wrap(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email et password sont requis' });
  }
  const effectiveRole = role ?? 'user';
  if (!['user', 'admin'].includes(effectiveRole)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const db = req.app.locals.db;
  if (await db.users.emailExists(email)) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email, passwordHash, role: effectiveRole });
  res.status(201).json(serializeAdminUser(user));
}));
```

- [ ] **Step 3 : Mettre à jour `PUT /users/:id`**

```js
router.put('/users/:id', wrap(async (req, res) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'email est requis' });
  }
  const effectiveRole = role ?? 'user';
  if (!['user', 'admin'].includes(effectiveRole)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const selfId = String(req.user._id ?? req.user.id);
  if (selfId === req.params.id && effectiveRole !== 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier votre propre rôle' });
  }
  const db = req.app.locals.db;
  try {
    const updated = await db.users.updateByAdmin(req.params.id, { email, role: effectiveRole });
    if (!updated) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(serializeAdminUser(updated));
  } catch (err) {
    if (err.code === 11000 || err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: 'Email déjà utilisé' });
    }
    throw err;
  }
}));
```

- [ ] **Step 4 : Commit**

```bash
git add server/routes/admin.js
git commit -m "feat(server): update admin routes to use email instead of username"
```

---

## Task 6 : Client — API profile + LoginPage

**Files:**
- Modify: `client/src/api/profile.js`
- Modify: `client/src/pages/LoginPage.jsx`
- Modify: `client/src/tests/LoginPage.test.jsx`

- [ ] **Step 1 : Mettre à jour les tests de LoginPage pour qu'ils échouent**

Remplacer le contenu de `client/src/tests/LoginPage.test.jsx` :

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth', () => ({
  config: vi.fn().mockResolvedValue({ googleEnabled: false }),
  login: vi.fn(),
  register: vi.fn(),
}));

const mockLogin = vi.fn();
const mockRegister = vi.fn();
vi.mock('../store/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, register: mockRegister }),
}));

const Wrapper = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('affiche les onglets Connexion et Inscription', () => {
    render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByText('Connexion')).toBeInTheDocument();
    expect(screen.getByText('Inscription')).toBeInTheDocument();
  });

  it('soumet le formulaire de connexion avec email', async () => {
    mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
    render(<LoginPage />, { wrapper: Wrapper });

    await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({ email: 'alice@test.com', password: 'pass1234' })
    );
  });

  it("bascule vers l'onglet inscription et change le bouton submit", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await userEvent.click(screen.getByText('Inscription'));
    expect(screen.getByRole('button', { name: "S'inscrire" })).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Google si googleEnabled est false", async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() => expect(authApi.config).toHaveBeenCalled());
    expect(screen.queryByText('Continuer avec Google')).not.toBeInTheDocument();
  });

  it('affiche le bouton Google si googleEnabled est true', async () => {
    authApi.config.mockResolvedValue({ googleEnabled: true });
    render(<LoginPage />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(screen.getByText('Continuer avec Google')).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
yarn --cwd client test
```

Attendu : le test "soumet le formulaire de connexion avec email" échoue car le label est encore "Nom d'utilisateur".

- [ ] **Step 3 : Mettre à jour `LoginPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { config as fetchConfig } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      tab === 'login' ? await login(form) : await register(form);
    } catch (err) {
      toast.error(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
      <div className="pointer-events-none absolute -right-20 -top-40 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.18)_0%,transparent_65%)]" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_65%)]" />

      <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl">
        <div className="mb-9 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Wallet className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1.5 text-2xl font-extrabold tracking-tight text-slate-900">Gestion de Comptes</h1>
          <p className="text-sm text-slate-500">Gérez vos finances en toute sérénité</p>
        </div>

        {googleError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Échec de la connexion Google
          </div>
        )}

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              className="mb-4 w-full gap-2"
              size="lg"
              onClick={() => { window.location.href = '/api/auth/google'; }}
            >
              <Globe className="h-4 w-4" />
              Continuer avec Google
            </Button>
            <div className="relative mb-4 flex items-center gap-3">
              <span className="flex-1 border-t border-slate-200" />
              <span className="text-xs text-slate-400">ou</span>
              <span className="flex-1 border-t border-slate-200" />
            </div>
          </>
        )}

        <div className="mb-7 flex gap-1 rounded-xl bg-slate-100 p-1">
          {[['login', 'Connexion'], ['register', 'Inscription']].map(([key, label]) => (
            <button
              type="button"
              key={key}
              onClick={() => { setTab(key); setForm({ email: '', password: '' }); }}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
                tab === key
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="h-11"
            />
          </div>
          <Button
            type="submit"
            className="mt-2 h-11 w-full text-base shadow-md shadow-indigo-500/30"
            disabled={loading}
          >
            {loading ? 'Chargement…' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Ajouter `updateEmail` dans `api/profile.js`**

```js
import client from './client';

export const updateProfile = (data) => client.put('/auth/profile', data);

export const updateEmail = (email) => client.put('/auth/email', { email });

export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('avatar', file);
  return client.post('/auth/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

```bash
yarn --cwd client test
```

Attendu : tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add client/src/api/profile.js client/src/pages/LoginPage.jsx client/src/tests/LoginPage.test.jsx
git commit -m "feat(client): use email as login identifier, add updateEmail API"
```

---

## Task 7 : Client — AppShell, ProfilePage, UserFormModal

**Files:**
- Modify: `client/src/components/layout/AppShell.jsx`
- Modify: `client/src/pages/ProfilePage.jsx`
- Modify: `client/src/components/admin/UserFormModal.jsx`

- [ ] **Step 1 : Mettre à jour `AppShell.jsx` — displayName fallback**

Remplacer la ligne `displayName` :

```js
const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
const displayName = user?.nickname || fullName || user?.email;
```

- [ ] **Step 2 : Mettre à jour `ProfilePage.jsx`**

```jsx
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
  const { user, updateUser, logout } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title:     user?.title     ?? 'none',
    firstName: user?.firstName ?? '',
    lastName:  user?.lastName  ?? '',
    nickname:  user?.nickname  ?? '',
  });
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await profileApi.updateProfile({
        ...form,
        title: form.title === 'none' ? null : form.title,
      });
      updateUser(updated);
      toast.success('Profil enregistré');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const onSaveEmail = async (e) => {
    e.preventDefault();
    setSavingEmail(true);
    try {
      const updated = await profileApi.updateEmail(email);
      updateUser(updated);
      toast.success('Adresse email mise à jour');
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Adresse email déjà utilisée');
      } else {
        toast.error(err.message || 'Erreur');
      }
    } finally {
      setSavingEmail(false);
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
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const displayName = user?.nickname || fullName || user?.email;
  const initials = displayName?.slice(0, 2).toUpperCase() ?? '??';
  const avatarSrc = user?.avatarUrl ?? undefined;

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
          {uploading ? 'Envoi…' : "Changer l'avatar"}
        </Button>
      </div>

      {/* Email */}
      <form onSubmit={onSaveEmail} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={savingEmail} className="w-full">
          {savingEmail ? 'Enregistrement…' : "Mettre à jour l'email"}
        </Button>
      </form>

      {/* Profil */}
      <form onSubmit={onSave} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label>Titre</Label>
          <Select value={form.title} onValueChange={set('title')}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
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
          <Input id="nickname" value={form.nickname} onChange={set('nickname')} placeholder={user?.email} />
        </div>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      {/* Déconnexion */}
      <button
        type="button"
        onClick={logout}
        className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
      >
        Déconnexion
      </button>
    </div>
  );
}
```

- [ ] **Step 3 : Mettre à jour `UserFormModal.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { email: '', password: '', role: 'user' };

export default function UserFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { email: initial.email ?? '', password: '', role: initial.role }
        : EMPTY
      );
      setError('');
    }
  }, [open, initial]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target?.value ?? e }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) {
      return setError('Email requis.');
    }
    if (!isEdit && form.password.length < 8) {
      return setError('Le mot de passe doit faire au moins 8 caractères.');
    }
    setSaving(true);
    try {
      const payload = isEdit
        ? { email: form.email, role: form.role }
        : { email: form.email, password: form.password, role: form.role };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="uf-email">Email</Label>
            <Input id="uf-email" type="email" value={form.email} onChange={set('email')} />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label htmlFor="uf-password">Mot de passe</Label>
              <Input id="uf-password" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Rôle</Label>
            <Select value={form.role} onValueChange={set('role')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utilisateur</SelectItem>
                <SelectItem value="admin">Administrateur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : (isEdit ? 'Enregistrer' : 'Créer')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4 : Lancer les tests**

```bash
yarn --cwd client test
```

Attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add client/src/components/layout/AppShell.jsx client/src/pages/ProfilePage.jsx client/src/components/admin/UserFormModal.jsx
git commit -m "feat(client): remove username, use email as identifier in UI"
```

---

## Task 8 : Vérification end-to-end

- [ ] **Step 1 : Démarrer l'application complète**

```bash
yarn dev
```

Ouvrir `http://localhost:5173`.

- [ ] **Step 2 : Vérifier le flow inscription**

- Aller sur `/login`, onglet Inscription
- Saisir un email et un mot de passe (min 8 chars) → cliquer "S'inscrire"
- Attendu : redirection vers `/`, header affiche l'email comme nom

- [ ] **Step 3 : Vérifier le flow connexion**

- Se déconnecter, retourner sur `/login`
- Se connecter avec l'email et le mot de passe → succès

- [ ] **Step 4 : Vérifier le changement d'email**

- Aller sur `/profile`
- Modifier l'email → "Mettre à jour l'email"
- Attendu : toast succès, header mis à jour

- [ ] **Step 5 : Vérifier la détection de doublon**

- Créer un second compte avec un email différent
- Essayer de changer l'email pour celui du premier compte
- Attendu : toast "Adresse email déjà utilisée"

- [ ] **Step 6 : Vérifier le flow admin**

- Se connecter en admin (définir `ADMIN_EMAIL` + `ADMIN_PASSWORD` dans `server/.env`)
- Aller sur `/admin` → créer un utilisateur (email + mot de passe)
- Modifier un utilisateur (email + rôle)
- Attendu : pas de champ username visible

- [ ] **Step 7 : Commit final si tout est bon**

```bash
git add -p  # vérifier qu'il n'y a pas de résidu
git commit -m "chore: post e2e cleanup" --allow-empty
```

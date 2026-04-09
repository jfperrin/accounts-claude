# Admin Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un rôle admin, une interface de gestion des utilisateurs (CRUD) et un reset de mot de passe par email dans l'application Comptes.

**Architecture:** Le champ `role` est ajouté au modèle User (Mongoose + SQLite). Un nouveau modèle `PasswordResetToken` gère les tokens de reset. Les routes `/api/admin/*` sont protégées par un middleware `requireAdmin`. Le client React affiche un menu "Administration" conditionnel au rôle et une page `/admin` de gestion des utilisateurs.

**Tech Stack:** Node.js/Express 5, Mongoose, better-sqlite3, resend (email), React, shadcn/ui, Tailwind CSS v4, lucide-react.

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `server/models/User.js` | Modifier — ajout `role`, `email` |
| `server/models/PasswordResetToken.js` | Créer — modèle Mongoose |
| `server/db/sqlite.js` | Modifier — migration colonnes + table tokens + nouveaux repos |
| `server/db/mongo.js` | Modifier — nouveaux repos users + resetTokens |
| `server/middleware/requireAdmin.js` | Créer |
| `server/utils/ensureAdmin.js` | Créer |
| `server/utils/mailer.js` | Créer |
| `server/routes/admin.js` | Créer |
| `server/routes/auth.js` | Modifier — routes reset + `role` dans serializeUser |
| `server/app.js` | Modifier — enregistrement route `/api/admin` |
| `server/index.js` | Modifier — appel `ensureAdmin` au boot |
| `client/src/components/layout/AppShell.jsx` | Modifier — nav admin conditionnelle |
| `client/src/App.jsx` | Modifier — routes `/admin` et `/reset-password` |
| `client/src/api/admin.js` | Créer |
| `client/src/components/RequireAdmin.jsx` | Créer |
| `client/src/pages/AdminPage.jsx` | Créer |
| `client/src/components/admin/UserFormModal.jsx` | Créer |
| `client/src/pages/ResetPasswordPage.jsx` | Créer |

---

## Task 1 — Champ `role` et `email` dans le modèle User

**Files:**
- Modify: `server/models/User.js`
- Modify: `server/db/sqlite.js`

- [ ] **Étape 1 : Ajouter `role` et `email` au schéma Mongoose**

Dans `server/models/User.js`, ajouter les deux champs dans le schéma après `avatarUrl` :

```js
const schema = new Schema({
  username:     { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String },
  googleId:     { type: String, trim: true },
  email:        { type: String, trim: true },
  role:         { type: String, enum: ['user', 'admin'], default: 'user' },
  title:        { type: String, trim: true },
  firstName:    { type: String, trim: true },
  lastName:     { type: String, trim: true },
  nickname:     { type: String, trim: true },
  avatarUrl:    { type: String, trim: true },
}, { timestamps: true });
```

- [ ] **Étape 2 : Migration SQLite — ajouter `role` et `email` + mapper**

Dans `server/db/sqlite.js`, dans la section de migrations idempotentes (après le bloc des colonnes de profil, ligne ~86), ajouter :

```js
  // Role et email — idempotent
  for (const col of [
    "ALTER TABLE users ADD COLUMN role  TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE users ADD COLUMN email TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* colonne déjà présente */ }
  }
```

Puis mettre à jour `mapUser` (ligne ~95) pour inclure `role` :

```js
const mapUser = (row) => row && {
  _id:          row.id,
  username:     row.username,
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

Et mettre à jour le SELECT de `findById` pour inclure `role` et `email` :

```js
findById: (id) =>
  mapUser(db.prepare(
    'SELECT id, username, email, role, google_id, title, first_name, last_name, nickname, avatar_url FROM users WHERE id = ?'
  ).get(id)),
```

- [ ] **Étape 3 : Mettre à jour `users.create` dans SQLite pour inclure `role`**

```js
create({ username, passwordHash, googleId, email, role }) {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO users (id, username, password_hash, google_id, email, role) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, username, passwordHash ?? null, googleId ?? null, email ?? null, role ?? 'user');
  return this.findById(id);
},
```

- [ ] **Étape 4 : Vérifier le démarrage du serveur**

```bash
cd server && yarn dev
```

Attendu : `SQLite connected: .../dev.db` sans erreur.

- [ ] **Étape 5 : Commit**

```bash
git add server/models/User.js server/db/sqlite.js
git commit -m "feat(server): add role and email fields to User model"
```

---

## Task 2 — Modèle PasswordResetToken

**Files:**
- Create: `server/models/PasswordResetToken.js`
- Modify: `server/db/sqlite.js`
- Modify: `server/db/mongo.js`

- [ ] **Étape 1 : Créer le modèle Mongoose**

`server/models/PasswordResetToken.js` :

```js
const { Schema, model } = require('mongoose');

const schema = new Schema({
  token:     { type: String, required: true, unique: true },
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expiresAt: { type: Date, required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PasswordResetToken', schema);
```

- [ ] **Étape 2 : Créer la table SQLite `password_reset_tokens`**

Dans `server/db/sqlite.js`, dans la fonction `initSchema`, ajouter dans le bloc `db.exec(...)` avant la fermeture du backtick :

```sql
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         TEXT PRIMARY KEY,
      token      TEXT NOT NULL UNIQUE,
      user_id    TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
```

- [ ] **Étape 3 : Ajouter le mapper SQLite**

Dans `server/db/sqlite.js`, après `mapRecurring` :

```js
const mapResetToken = (row) => row && {
  _id:       row.id,
  token:     row.token,
  userId:    row.user_id,
  expiresAt: new Date(row.expires_at),
  used:      row.used === 1,
};
```

- [ ] **Étape 4 : Ajouter le repo `resetTokens` dans SQLite**

Dans `server/db/sqlite.js`, avant le `return` final de `createSQLiteRepos()` :

```js
  const resetTokens = {
    create(userId, token, expiresAt) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO password_reset_tokens (id, token, user_id, expires_at) VALUES (?, ?, ?, ?)',
      ).run(id, token, uid(userId), expiresAt.toISOString());
      return mapResetToken(db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id));
    },

    findValid(token) {
      return mapResetToken(
        db.prepare(
          "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
        ).get(token),
      );
    },

    markUsed(token) {
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').run(token);
    },

    deleteByUser(userId) {
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(uid(userId));
    },
  };
```

Et ajouter `resetTokens` dans le `return` :

```js
  return { users, banks, operations, periods, recurringOps, resetTokens };
```

- [ ] **Étape 5 : Ajouter le repo `resetTokens` dans MongoDB**

Dans `server/db/mongo.js`, après les imports, ajouter :

```js
const PasswordResetToken = require('../models/PasswordResetToken');
```

Puis ajouter avant `module.exports` :

```js
// ─── RESET TOKENS ────────────────────────────────────────────────────────────
const resetTokens = {
  create: (userId, token, expiresAt) =>
    PasswordResetToken.create({ token, userId, expiresAt }),

  findValid: (token) =>
    PasswordResetToken.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    }),

  markUsed: (token) =>
    PasswordResetToken.updateOne({ token }, { $set: { used: true } }),

  deleteByUser: (userId) =>
    PasswordResetToken.deleteMany({ userId }),
};
```

Et ajouter `resetTokens` dans `module.exports` :

```js
module.exports = { users, banks, operations, periods, recurringOps, resetTokens };
```

- [ ] **Étape 6 : Vérifier le démarrage**

```bash
cd server && yarn dev
```

Attendu : démarrage sans erreur.

- [ ] **Étape 7 : Commit**

```bash
git add server/models/PasswordResetToken.js server/db/sqlite.js server/db/mongo.js
git commit -m "feat(server): add PasswordResetToken model and resetTokens repo"
```

---

## Task 3 — Méthodes admin du repo `users`

**Files:**
- Modify: `server/db/sqlite.js`
- Modify: `server/db/mongo.js`

- [ ] **Étape 1 : Ajouter `findAll`, `updateByAdmin`, `deleteUser` dans SQLite**

Dans `server/db/sqlite.js`, dans le bloc `users`, ajouter après `updateAvatar` :

```js
    findAll() {
      return db.prepare(
        'SELECT id, username, email, role, title, first_name, last_name, nickname, avatar_url, created_at FROM users ORDER BY created_at DESC',
      ).all().map(mapUser);
    },

    updateByAdmin(id, { username, email, role }) {
      db.prepare(
        `UPDATE users SET username=?, email=?, role=?, updated_at=datetime('now') WHERE id=?`,
      ).run(username ?? null, email ?? null, role ?? 'user', uid(id));
      return this.findById(id);
    },

    deleteUser(id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(uid(id));
    },
```

- [ ] **Étape 2 : Ajouter `findAll`, `updateByAdmin`, `deleteUser` dans MongoDB**

Dans `server/db/mongo.js`, dans le bloc `users`, ajouter après `updateAvatar` :

```js
  findAll: () =>
    User.find({}).select('-passwordHash').sort({ createdAt: -1 }),

  updateByAdmin: (id, { username, email, role }) =>
    User.findByIdAndUpdate(
      id,
      { $set: { username, email, role } },
      { new: true },
    ).select('-passwordHash'),

  deleteUser: (id) => User.findByIdAndDelete(id),
```

- [ ] **Étape 3 : Commit**

```bash
git add server/db/sqlite.js server/db/mongo.js
git commit -m "feat(server): add admin user repo methods (findAll, updateByAdmin, deleteUser)"
```

---

## Task 4 — Middleware `requireAdmin`

**Files:**
- Create: `server/middleware/requireAdmin.js`

- [ ] **Étape 1 : Créer le middleware**

`server/middleware/requireAdmin.js` :

```js
// Vérifie que l'utilisateur connecté a le rôle "admin".
// Toujours utilisé après requireAuth (qui garantit req.isAuthenticated()).
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Accès refusé' });
  }
  next();
};
```

- [ ] **Étape 2 : Commit**

```bash
git add server/middleware/requireAdmin.js
git commit -m "feat(server): add requireAdmin middleware"
```

---

## Task 5 — Mailer Resend

**Files:**
- Create: `server/utils/mailer.js`

- [ ] **Étape 1 : Installer le SDK Resend**

```bash
cd server && yarn add resend
```

- [ ] **Étape 2 : Créer `mailer.js`**

`server/utils/mailer.js` :

```js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM || 'onboarding@resend.dev';

async function sendPasswordResetEmail(to, resetUrl) {
  if (!process.env.RESEND_API_KEY) {
    // En dev sans clé configurée : log l'URL dans la console au lieu d'envoyer
    console.log(`[mailer] Reset URL pour ${to} : ${resetUrl}`);
    return;
  }
  await resend.emails.send({
    from: FROM,
    to,
    subject: 'Réinitialisation de votre mot de passe — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans <strong>1 heure</strong>.</p>
      <p>Si vous n'avez pas demandé cette action, ignorez cet email.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
```

- [ ] **Étape 3 : Ajouter `RESEND_API_KEY` dans `server/.env`**

```
RESEND_API_KEY=<votre_clé_resend>
RESEND_FROM=onboarding@resend.dev
```

- [ ] **Étape 4 : Vérifier l'absence de clé en dev (fallback console)**

```bash
cd server && node -e "require('./utils/mailer').sendPasswordResetEmail('test@test.com','http://localhost:5173/reset-password?token=abc')"
```

Attendu (sans RESEND_API_KEY définie) :
```
[mailer] Reset URL pour test@test.com : http://localhost:5173/reset-password?token=abc
```

- [ ] **Étape 5 : Commit**

```bash
git add server/utils/mailer.js server/package.json yarn.lock
git commit -m "feat(server): add Resend mailer utility"
```

---

## Task 6 — Seed admin au boot

**Files:**
- Create: `server/utils/ensureAdmin.js`
- Modify: `server/index.js`

- [ ] **Étape 1 : Créer `ensureAdmin.js`**

`server/utils/ensureAdmin.js` :

```js
const bcrypt = require('bcryptjs');

// Crée ou met à jour le compte admin si les variables d'environnement sont définies.
// Idempotent : peut être appelé à chaque démarrage sans effet de bord.
module.exports = async function ensureAdmin(db) {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_EMAIL) return;

  const existing = await db.users.findByUsername(ADMIN_USERNAME);
  if (existing) {
    if (existing.role !== 'admin') {
      await db.users.updateByAdmin(existing._id, {
        username: existing.username,
        email: existing.email,
        role: 'admin',
      });
    }
    console.log(`[admin] Compte admin "${ADMIN_USERNAME}" prêt.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await db.users.create({
    username: ADMIN_USERNAME,
    passwordHash,
    email: ADMIN_EMAIL,
    role: 'admin',
  });
  console.log(`[admin] Compte admin "${ADMIN_USERNAME}" créé.`);
};
```

- [ ] **Étape 2 : Appeler `ensureAdmin` dans `server/index.js`**

Dans `server/index.js`, ajouter l'appel après la sélection du backend DB (avant `createApp`) :

```js
async function main() {
  const useSQLite = process.env.NODE_ENV === 'development' || !process.env.MONGODB_URI;

  let db, mongoUri;
  if (useSQLite) {
    db = require('./db/sqlite')();
  } else {
    await require('./config/db')();
    db = require('./db/mongo');
    mongoUri = process.env.MONGODB_URI;
  }

  // Crée ou met à jour le compte admin si ADMIN_USERNAME/PASSWORD/EMAIL sont définis
  await require('./utils/ensureAdmin')(db);

  const app = createApp(db, mongoUri);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
}
```

- [ ] **Étape 3 : Ajouter les variables dans `server/.env`**

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
ADMIN_EMAIL=admin@example.com
```

- [ ] **Étape 4 : Vérifier la création du compte admin**

```bash
cd server && yarn dev
```

Attendu dans les logs : `[admin] Compte admin "admin" créé.`

Redémarrer une seconde fois — attendu : `[admin] Compte admin "admin" prêt.` (idempotent, pas de doublon).

- [ ] **Étape 5 : Commit**

```bash
git add server/utils/ensureAdmin.js server/index.js
git commit -m "feat(server): boot-time admin seed via ADMIN_USERNAME/PASSWORD/EMAIL env vars"
```

---

## Task 7 — Routes admin

**Files:**
- Create: `server/routes/admin.js`
- Modify: `server/app.js`

- [ ] **Étape 1 : Créer `server/routes/admin.js`**

```js
// Routes de gestion des utilisateurs — accès admin uniquement.
// Préfixe : /api/admin
// Protégées par requireAuth + requireAdmin dans app.js.

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const wrap = require('../utils/asyncHandler');
const { sendPasswordResetEmail } = require('../utils/mailer');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Sérialise un user pour la liste admin (pas de passwordHash)
function serializeAdminUser(u) {
  return {
    _id:       u._id ?? u.id,
    username:  u.username,
    email:     u.email ?? null,
    role:      u.role ?? 'user',
    firstName: u.firstName ?? null,
    lastName:  u.lastName ?? null,
    nickname:  u.nickname ?? null,
    createdAt: u.createdAt ?? null,
  };
}

// GET /api/admin/users — liste tous les utilisateurs
router.get('/users', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const users = await db.users.findAll();
  res.json(users.map(serializeAdminUser));
}));

// POST /api/admin/users — crée un utilisateur
router.post('/users', wrap(async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email et password sont requis' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  const db = req.app.locals.db;
  if (await db.users.usernameExists(username)) {
    return res.status(409).json({ message: "Nom d'utilisateur déjà pris" });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ username, email, passwordHash, role: role || 'user' });
  res.status(201).json(serializeAdminUser(user));
}));

// PUT /api/admin/users/:id — modifie username, email, role
router.put('/users/:id', wrap(async (req, res) => {
  const { username, email, role } = req.body;
  if (!username || !email) {
    return res.status(400).json({ message: 'username et email sont requis' });
  }
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Rôle invalide' });
  }
  // Empêche un admin de se rétrograder lui-même
  const selfId = String(req.user._id ?? req.user.id);
  if (selfId === req.params.id && role !== 'admin') {
    return res.status(400).json({ message: 'Impossible de modifier votre propre rôle' });
  }
  const db = req.app.locals.db;
  const updated = await db.users.updateByAdmin(req.params.id, { username, email, role });
  if (!updated) return res.status(404).json({ message: 'Utilisateur introuvable' });
  res.json(serializeAdminUser(updated));
}));

// DELETE /api/admin/users/:id — supprime user + toutes ses données en cascade
router.delete('/users/:id', wrap(async (req, res) => {
  const selfId = String(req.user._id ?? req.user.id);
  if (selfId === req.params.id) {
    return res.status(400).json({ message: 'Impossible de supprimer votre propre compte' });
  }
  const db = req.app.locals.db;
  const targetId = req.params.id;
  // Cascade : operations → periods → recurringOps → banks → resetTokens → user
  const periods = await db.periods.findByUser(targetId);
  for (const p of periods) {
    await db.operations.deleteByPeriod(p._id, targetId);
  }
  await db.periods.deleteByUser(targetId);
  await db.recurringOps.deleteByUser(targetId);
  await db.banks.deleteByUser(targetId);
  await db.resetTokens.deleteByUser(targetId);
  await db.users.deleteUser(targetId);
  res.json({ message: 'Utilisateur supprimé' });
}));

// POST /api/admin/users/:id/reset-password — envoie un email de reset
router.post('/users/:id/reset-password', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  if (!user.email) return res.status(400).json({ message: "L'utilisateur n'a pas d'email" });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // +1h
  await db.resetTokens.create(user._id, token, expiresAt);

  const resetUrl = `${CLIENT_URL}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetUrl);

  res.json({ message: 'Email de réinitialisation envoyé' });
}));

module.exports = router;
```

- [ ] **Étape 2 : Enregistrer la route dans `server/app.js`**

Dans `server/app.js`, ajouter après les imports en haut :

```js
const requireAdmin = require('./middleware/requireAdmin');
```

Et dans le bloc des routes protégées (après `/api/operations`) :

```js
  app.use('/api/admin', requireAuth, requireAdmin, require('./routes/admin'));
```

- [ ] **Étape 3 : Vérifier les routes avec curl**

```bash
# Connexion (remplacer avec vos credentials admin)
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"changeme"}'

# Liste des utilisateurs
curl -b cookies.txt http://localhost:3001/api/admin/users
```

Attendu : tableau JSON avec au moins l'utilisateur admin.

```bash
# Accès sans session → 401
curl http://localhost:3001/api/admin/users
```

Attendu : `{"message":"Non authentifié"}`

- [ ] **Étape 4 : Ajouter les méthodes manquantes dans les repos pour la cascade de suppression**

Dans `server/db/mongo.js`, ajouter dans `banks` :

```js
  deleteByUser: (userId) => Bank.deleteMany({ userId }),
```

Dans `server/db/sqlite.js`, dans le bloc `banks` :

```js
    deleteByUser: (userId) =>
      db.prepare('DELETE FROM banks WHERE user_id = ?').run(uid(userId)),
```

Dans `server/db/mongo.js`, ajouter dans `periods` :

```js
  deleteByUser: (userId) => Period.deleteMany({ userId }),
```

Dans `server/db/sqlite.js`, dans le bloc `periods` :

```js
    deleteByUser: (userId) =>
      db.prepare('DELETE FROM periods WHERE user_id = ?').run(uid(userId)),
```

Dans `server/db/mongo.js`, ajouter dans `recurringOps` :

```js
  deleteByUser: (userId) => RecurringOperation.deleteMany({ userId }),
```

Dans `server/db/sqlite.js`, dans le bloc `recurringOps` :

```js
    deleteByUser: (userId) =>
      db.prepare('DELETE FROM recurring_operations WHERE user_id = ?').run(uid(userId)),
```

- [ ] **Étape 5 : Commit**

```bash
git add server/routes/admin.js server/app.js server/db/mongo.js server/db/sqlite.js
git commit -m "feat(server): admin routes for user CRUD and password reset trigger"
```

---

## Task 8 — Routes reset mot de passe + `role` dans serializeUser

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Étape 1 : Ajouter `role` dans `serializeUser`**

Dans `server/routes/auth.js`, modifier la fonction `serializeUser` :

```js
function serializeUser(u) {
  return {
    _id:       u._id ?? u.id,
    username:  u.username,
    role:      u.role ?? 'user',
    title:     u.title     ?? null,
    firstName: u.firstName ?? null,
    lastName:  u.lastName  ?? null,
    nickname:  u.nickname  ?? null,
    avatarUrl: u.avatarUrl ?? null,
  };
}
```

- [ ] **Étape 2 : Ajouter les routes de reset en fin de fichier (avant `module.exports`)**

```js
// GET /api/auth/reset-password/:token — vérifie la validité du token
router.get('/reset-password/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record) return res.status(410).json({ message: 'Lien invalide ou expiré' });
  res.json({ valid: true });
}));

// POST /api/auth/reset-password/:token — applique le nouveau mot de passe
router.post('/reset-password/:token', wrap(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record) return res.status(410).json({ message: 'Lien invalide ou expiré' });

  const passwordHash = await bcrypt.hash(password, 12);
  // updateProfile ne touche pas passwordHash — on utilise une mise à jour directe
  await db.users.setPassword(record.userId, passwordHash);
  await db.resetTokens.markUsed(req.params.token);

  res.json({ message: 'Mot de passe mis à jour' });
}));
```

- [ ] **Étape 3 : Ajouter `setPassword` dans les repos**

Dans `server/db/mongo.js`, dans `users` :

```js
  setPassword: (id, passwordHash) =>
    User.findByIdAndUpdate(id, { $set: { passwordHash } }),
```

Dans `server/db/sqlite.js`, dans `users` :

```js
    setPassword(id, passwordHash) {
      db.prepare(
        `UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`
      ).run(passwordHash, uid(id));
    },
```

- [ ] **Étape 4 : Vérifier `GET /api/auth/me` inclut bien `role`**

```bash
curl -b cookies.txt http://localhost:3001/api/auth/me
```

Attendu : `{"_id":"...","username":"admin","role":"admin",...}`

- [ ] **Étape 5 : Commit**

```bash
git add server/routes/auth.js server/db/mongo.js server/db/sqlite.js
git commit -m "feat(server): add role to serializeUser and password reset routes"
```

---

## Task 9 — Navigation admin dans AppShell + routes client

**Files:**
- Modify: `client/src/components/layout/AppShell.jsx`
- Modify: `client/src/App.jsx`
- Create: `client/src/components/RequireAdmin.jsx`

- [ ] **Étape 1 : Ajouter `ShieldCheck` à l'import lucide dans AppShell**

Dans `client/src/components/layout/AppShell.jsx`, modifier la ligne d'import lucide :

```js
import { LayoutDashboard, Building2, RefreshCw, LogOut, ChevronLeft, ChevronRight, Wallet, UserCircle, ShieldCheck } from 'lucide-react';
```

- [ ] **Étape 2 : Rendre NAV_ITEMS et BOTTOM_TABS dynamiques selon le rôle**

Remplacer les constantes `NAV_ITEMS` et `BOTTOM_TABS` par une fonction dans le composant. Modifier `AppShell` :

```js
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isAdmin = user?.role === 'admin';

  const NAV_ITEMS = [
    { key: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { key: '/banks', icon: Building2, label: 'Banques' },
    { key: '/recurring', icon: RefreshCw, label: 'Opérations récurrentes' },
    ...(isAdmin ? [{ key: '/admin', icon: ShieldCheck, label: 'Administration' }] : []),
  ];

  const BOTTOM_TABS = [
    { key: '/', icon: LayoutDashboard, label: 'Accueil' },
    { key: '/banks', icon: Building2, label: 'Banques' },
    { key: '/recurring', icon: RefreshCw, label: 'Récurrents' },
    { key: '/profile', icon: UserCircle, label: 'Profil' },
    ...(isAdmin ? [{ key: '/admin', icon: ShieldCheck, label: 'Admin' }] : []),
  ];

  // ... reste du composant inchangé
```

- [ ] **Étape 3 : Créer `RequireAdmin.jsx`**

`client/src/components/RequireAdmin.jsx` :

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';

export default function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Étape 4 : Ajouter les routes `/admin` et `/reset-password` dans `App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';
import ProfilePage from '@/pages/ProfilePage';
import AdminPage from '@/pages/AdminPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import RequireAdmin from '@/components/RequireAdmin';

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
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Étape 5 : Commit (fichiers client créés/modifiés à ce stade — pages vides acceptables)**

Créer des pages stub vides pour que l'import ne plante pas :

`client/src/pages/AdminPage.jsx` (stub) :
```jsx
export default function AdminPage() {
  return <div>Admin</div>;
}
```

`client/src/pages/ResetPasswordPage.jsx` (stub) :
```jsx
export default function ResetPasswordPage() {
  return <div>Reset Password</div>;
}
```

```bash
git add client/src/components/layout/AppShell.jsx client/src/App.jsx \
  client/src/components/RequireAdmin.jsx \
  client/src/pages/AdminPage.jsx client/src/pages/ResetPasswordPage.jsx
git commit -m "feat(client): admin nav item + RequireAdmin guard + route stubs"
```

---

## Task 10 — API client admin

**Files:**
- Create: `client/src/api/admin.js`

- [ ] **Étape 1 : Créer `client/src/api/admin.js`**

```js
import api from './client';

export const getUsers      = ()              => api.get('/admin/users').then(r => r.data);
export const createUser    = (data)          => api.post('/admin/users', data).then(r => r.data);
export const updateUser    = (id, data)      => api.put(`/admin/users/${id}`, data).then(r => r.data);
export const deleteUser    = (id)            => api.delete(`/admin/users/${id}`).then(r => r.data);
export const sendReset     = (id)            => api.post(`/admin/users/${id}/reset-password`).then(r => r.data);
```

- [ ] **Étape 2 : Commit**

```bash
git add client/src/api/admin.js
git commit -m "feat(client): admin API client"
```

---

## Task 11 — `UserFormModal.jsx`

**Files:**
- Create: `client/src/components/admin/UserFormModal.jsx`

- [ ] **Étape 1 : Créer le modal**

`client/src/components/admin/UserFormModal.jsx` :

```jsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMPTY = { username: '', email: '', password: '', role: 'user' };

export default function UserFormModal({ open, onClose, onSubmit, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial
        ? { username: initial.username, email: initial.email ?? '', password: '', role: initial.role }
        : EMPTY
      );
      setError('');
    }
  }, [open, initial]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target?.value ?? e }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.email.trim()) {
      return setError('Username et email sont requis.');
    }
    if (!isEdit && form.password.length < 8) {
      return setError('Le mot de passe doit faire au moins 8 caractères.');
    }
    setSaving(true);
    try {
      const payload = isEdit
        ? { username: form.username, email: form.email, role: form.role }
        : { username: form.username, email: form.email, password: form.password, role: form.role };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="uf-username">Nom d'utilisateur</Label>
            <Input id="uf-username" value={form.username} onChange={set('username')} autoComplete="off" />
          </div>
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

- [ ] **Étape 2 : Commit**

```bash
git add client/src/components/admin/UserFormModal.jsx
git commit -m "feat(client): UserFormModal for admin create/edit"
```

---

## Task 12 — `AdminPage.jsx`

**Files:**
- Modify: `client/src/pages/AdminPage.jsx`

- [ ] **Étape 1 : Implémenter la page admin complète**

`client/src/pages/AdminPage.jsx` :

```jsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import * as adminApi from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserFormModal from '@/components/admin/UserFormModal';

export default function AdminPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await adminApi.getUsers());
    } catch {
      toast.error('Impossible de charger les utilisateurs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    const created = await adminApi.createUser(data);
    setUsers(prev => [created, ...prev]);
    toast.success(`Utilisateur "${created.username}" créé.`);
  };

  const handleEdit = async (data) => {
    const updated = await adminApi.updateUser(editing._id, data);
    setUsers(prev => prev.map(u => u._id === updated._id ? updated : u));
    toast.success('Utilisateur mis à jour.');
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteUser(deleteTarget._id);
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      toast.success(`Utilisateur "${deleteTarget.username}" supprimé.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReset = async (u) => {
    try {
      await adminApi.sendReset(u._id);
      toast.success(`Email de réinitialisation envoyé à ${u.email}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'envoi.');
    }
  };

  const isSelf = (u) => u._id === (me?._id ?? me?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold">Administration — Utilisateurs</h1>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nouvel utilisateur
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Utilisateur</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u._id} className="bg-card hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    {u.username}
                    {isSelf(u) && <span className="ml-2 text-xs text-muted-foreground">(vous)</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                      {u.role === 'admin' ? 'Admin' : 'Utilisateur'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { setEditing(u); setModalOpen(true); }}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        disabled={!u.email}
                        onClick={() => handleReset(u)}
                        title="Réinitialiser le mot de passe"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        disabled={isSelf(u)}
                        onClick={() => setDeleteTarget(u)}
                        title="Supprimer"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UserFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={editing ? handleEdit : handleCreate}
        initial={editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement <strong>{deleteTarget?.username}</strong> et toutes ses données (banques, opérations, périodes). Elle est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Étape 2 : Vérifier que la page s'affiche sans erreur en étant connecté admin**

```bash
cd client && yarn dev
```

Naviguer vers `http://localhost:5173/admin` — attendu : tableau des utilisateurs avec l'admin listé.

- [ ] **Étape 3 : Commit**

```bash
git add client/src/pages/AdminPage.jsx
git commit -m "feat(client): AdminPage with user table, create/edit modal and delete dialog"
```

---

## Task 13 — `ResetPasswordPage.jsx`

**Files:**
- Modify: `client/src/pages/ResetPasswordPage.jsx`

- [ ] **Étape 1 : Implémenter la page**

`client/src/pages/ResetPasswordPage.jsx` :

```jsx
import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/api/client';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('checking'); // checking | valid | invalid | done | error
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get(`/auth/reset-password/${token}`)
      .then(() => setStatus('valid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.password.length < 8) return setErrorMsg('Le mot de passe doit faire au moins 8 caractères.');
    if (form.password !== form.confirm) return setErrorMsg('Les mots de passe ne correspondent pas.');
    setSaving(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Erreur, veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Comptes</span>
        </div>

        {status === 'checking' && (
          <p className="text-center text-muted-foreground">Vérification du lien…</p>
        )}

        {status === 'invalid' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center space-y-3">
            <p className="text-sm font-medium text-destructive">Ce lien est invalide ou a expiré.</p>
            <p className="text-xs text-muted-foreground">Contactez un administrateur pour obtenir un nouveau lien.</p>
          </div>
        )}

        {status === 'valid' && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
            <h1 className="text-lg font-bold text-center">Nouveau mot de passe</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="rp-password">Mot de passe</Label>
                <Input
                  id="rp-password" type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rp-confirm">Confirmer</Label>
                <Input
                  id="rp-confirm" type="password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  autoComplete="new-password"
                />
              </div>
              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Changer le mot de passe'}
              </Button>
            </form>
          </div>
        )}

        {status === 'done' && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm text-center space-y-4">
            <p className="font-medium">Mot de passe mis à jour !</p>
            <Button asChild className="w-full">
              <Link to="/login">Se connecter</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Étape 2 : Tester le flow complet**

1. Se connecter comme admin
2. Aller sur `/admin`, cliquer sur l'icône de reset pour un utilisateur avec email
3. En dev (sans RESEND_API_KEY) : copier l'URL depuis les logs du serveur
4. Ouvrir l'URL dans le navigateur → formulaire de nouveau mot de passe
5. Soumettre → message de confirmation
6. Se connecter avec le nouveau mot de passe → succès

- [ ] **Étape 3 : Commit final**

```bash
git add client/src/pages/ResetPasswordPage.jsx
git commit -m "feat(client): ResetPasswordPage with token validation and password form"
```

---

## Checklist de vérification finale

- [ ] `GET /api/auth/me` retourne `role` dans la réponse JSON
- [ ] Connexion avec `admin` / `changeme` fonctionne (compte créé au boot)
- [ ] Menu "Administration" visible dans la sidebar uniquement pour l'admin
- [ ] `GET /api/admin/users` retourne 401 sans session, 403 avec session non-admin, 200 avec session admin
- [ ] Création d'un utilisateur → apparaît dans la liste
- [ ] Modification d'un utilisateur → mis à jour dans la liste
- [ ] Suppression d'un utilisateur → retiré de la liste
- [ ] Reset de mot de passe → URL loguée en console (dev) ou email envoyé (prod)
- [ ] `/reset-password?token=<token_valide>` → formulaire affiché
- [ ] `/reset-password?token=<token_expiré>` → message d'erreur
- [ ] Un admin ne peut pas se supprimer lui-même (bouton désactivé + 400 côté API)

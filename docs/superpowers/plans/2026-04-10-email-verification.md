# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la vérification d'email par lien magique à l'inscription et au changement d'email, avec tous les emails envoyés depuis jf@perrin.at via Resend.

**Architecture:** On étend le modèle `PasswordResetToken` existant avec deux champs optionnels (`type`, `pendingEmail`) pour gérer trois types de tokens : `password_reset`, `email_verify`, `email_change`. Les comptes Google sont créés avec `emailVerified: true` et ignorent la vérification. L'inscription ne crée plus de session — l'utilisateur doit valider son email avant de pouvoir se connecter.

**Tech Stack:** Node.js / Express 5, Mongoose (prod), better-sqlite3 (dev), Resend SDK, React / Vite, shadcn/ui.

---

## File Map

### Server — créés/modifiés

| Fichier | Changement |
|---------|-----------|
| `server/models/PasswordResetToken.js` | + champs `type`, `pendingEmail` |
| `server/models/User.js` | + champ `emailVerified` |
| `server/db/sqlite.js` | migrations, mappers, nouveaux repos |
| `server/db/mongo.js` | `resetTokens.create` + méthodes users |
| `server/utils/mailer.js` | FROM fixe, 2 nouvelles fonctions |
| `server/routes/auth.js` | register, login, PUT /email, + 2 routes |
| `server/tests/helpers.js` | helper `createVerifiedUser` |
| `server/tests/auth.test.js` | mise à jour des tests existants + nouveaux |

### Client — modifiés

| Fichier | Changement |
|---------|-----------|
| `client/src/api/auth.js` | + `resendVerification` |
| `client/src/store/AuthContext.jsx` | `register` ne set plus `user` |
| `client/src/pages/LoginPage.jsx` | écran post-inscription, banner 403, `?verified=1` |
| `client/src/pages/ProfilePage.jsx` | banner non-vérifié, message email change |

---

## Task 1 : Étendre les modèles Mongoose

**Files:**
- Modify: `server/models/PasswordResetToken.js`
- Modify: `server/models/User.js`

- [ ] **Step 1 : Mettre à jour PasswordResetToken.js**

```js
// server/models/PasswordResetToken.js
const { Schema, model } = require('mongoose');

const schema = new Schema({
  token:        { type: String, required: true, unique: true },
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['password_reset', 'email_verify', 'email_change'], default: 'password_reset' },
  pendingEmail: { type: String, trim: true },
  expiresAt:    { type: Date, required: true },
  used:         { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PasswordResetToken', schema);
```

- [ ] **Step 2 : Mettre à jour User.js**

```js
// server/models/User.js
const { Schema, model } = require('mongoose');

const schema = new Schema({
  passwordHash:  { type: String },
  googleId:      { type: String, trim: true },
  email:         { type: String, required: true, unique: true, trim: true },
  emailVerified: { type: Boolean, default: false },
  role:          { type: String, enum: ['user', 'admin'], default: 'user' },
  title:         { type: String, trim: true },
  firstName:     { type: String, trim: true },
  lastName:      { type: String, trim: true },
  nickname:      { type: String, trim: true },
  avatarUrl:     { type: String, trim: true },
}, { timestamps: true });

schema.index({ googleId: 1 }, { unique: true, sparse: true });

module.exports = model('User', schema);
```

- [ ] **Step 3 : Commit**

```bash
git add server/models/PasswordResetToken.js server/models/User.js
git commit -m "feat(models): add emailVerified to User, add type/pendingEmail to PasswordResetToken"
```

---

## Task 2 : Migrations SQLite + mappers

**Files:**
- Modify: `server/db/sqlite.js`

- [ ] **Step 1 : Ajouter les migrations dans `initSchema`**

Dans la boucle d'`ALTER TABLE` existante qui gère les profils (autour de la ligne 94), ajouter trois nouvelles colonnes à la suite des colonnes existantes :

```js
  for (const col of [
    "ALTER TABLE users ADD COLUMN role  TEXT NOT NULL DEFAULT 'user'",
    'ALTER TABLE users ADD COLUMN title      TEXT',
    'ALTER TABLE users ADD COLUMN first_name TEXT',
    'ALTER TABLE users ADD COLUMN last_name  TEXT',
    'ALTER TABLE users ADD COLUMN nickname   TEXT',
    'ALTER TABLE users ADD COLUMN avatar_url TEXT',
    // Nouvelles colonnes
    'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
    "ALTER TABLE password_reset_tokens ADD COLUMN type TEXT NOT NULL DEFAULT 'password_reset'",
    'ALTER TABLE password_reset_tokens ADD COLUMN pending_email TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }
```

- [ ] **Step 2 : Mettre à jour `mapUser` pour inclure `emailVerified`**

Remplacer la fonction `mapUser` existante (ligne ~110) :

```js
const mapUser = (row) => row && {
  _id:           row.id,
  passwordHash:  row.password_hash,
  googleId:      row.google_id,
  email:         row.email ?? null,
  emailVerified: row.email_verified === 1,
  role:          row.role ?? 'user',
  title:         row.title ?? null,
  firstName:     row.first_name ?? null,
  lastName:      row.last_name ?? null,
  nickname:      row.nickname ?? null,
  avatarUrl:     row.avatar_url ?? null,
};
```

- [ ] **Step 3 : Mettre à jour `mapResetToken` pour inclure `type` et `pendingEmail`**

Remplacer la fonction `mapResetToken` existante (ligne ~160) :

```js
const mapResetToken = (row) => row && {
  _id:          row.id,
  token:        row.token,
  userId:       row.user_id,
  type:         row.type ?? 'password_reset',
  pendingEmail: row.pending_email ?? null,
  expiresAt:    new Date(row.expires_at),
  used:         row.used === 1,
};
```

- [ ] **Step 4 : Mettre à jour `users.findById` pour sélectionner `email_verified`**

Remplacer la ligne `findById` dans le repo users (ligne ~202) :

```js
findById: (id) =>
  mapUser(db.prepare('SELECT id, email, email_verified, role, google_id, title, first_name, last_name, nickname, avatar_url FROM users WHERE id = ?').get(id)),
```

- [ ] **Step 5 : Mettre à jour `users.findAll` pour sélectionner `email_verified`**

Remplacer la méthode `findAll` :

```js
findAll() {
  return db.prepare(
    'SELECT id, email, email_verified, role, title, first_name, last_name, nickname, avatar_url, created_at FROM users ORDER BY created_at DESC',
  ).all().map(mapUser);
},
```

- [ ] **Step 6 : Mettre à jour `users.create` pour propager `emailVerified`**

Remplacer la méthode `create` du repo users :

```js
create({ email, passwordHash, googleId, role }) {
  const id = randomUUID();
  const emailVerified = googleId ? 1 : 0;
  db.prepare(
    'INSERT INTO users (id, email, password_hash, google_id, role, email_verified) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, email, passwordHash ?? null, googleId ?? null, role ?? 'user', emailVerified);
  return this.findById(id);
},
```

- [ ] **Step 7 : Ajouter `users.setEmailVerified` et `users.applyPendingEmail`**

Ajouter après la méthode `setPassword` du repo users (ligne ~255) :

```js
setEmailVerified(id) {
  db.prepare(`UPDATE users SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(uid(id));
  return this.findById(id);
},

applyPendingEmail(id, email) {
  db.prepare(
    `UPDATE users SET email = ?, email_verified = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(email, uid(id));
  return this.findById(id);
},
```

- [ ] **Step 8 : Mettre à jour `resetTokens.create` pour accepter `type` et `pendingEmail`**

Remplacer la méthode `create` du repo resetTokens :

```js
create(userId, token, expiresAt, { type = 'password_reset', pendingEmail = null } = {}) {
  const id = randomUUID();
  db.prepare(
    'INSERT INTO password_reset_tokens (id, token, user_id, expires_at, type, pending_email) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, token, uid(userId), expiresAt.toISOString(), type, pendingEmail ?? null);
  return mapResetToken(db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id));
},
```

- [ ] **Step 9 : Commit**

```bash
git add server/db/sqlite.js
git commit -m "feat(sqlite): add email_verified + token type/pendingEmail — migrations + mappers + repos"
```

---

## Task 3 : Mettre à jour le repo MongoDB

**Files:**
- Modify: `server/db/mongo.js`

- [ ] **Step 1 : Mettre à jour `users.create` pour propager `emailVerified`**

Remplacer la ligne `create` dans le repo users (ligne ~28) :

```js
create: (data) => User.create({ ...data, emailVerified: !!data.googleId }),
```

- [ ] **Step 2 : Ajouter `users.setEmailVerified` et `users.applyPendingEmail`**

Ajouter après `setPassword` dans le repo users (ligne ~57) :

```js
setEmailVerified: (id) =>
  User.findByIdAndUpdate(id, { $set: { emailVerified: true } }, { new: true }).select('-passwordHash'),

applyPendingEmail: (id, email) =>
  User.findByIdAndUpdate(id, { $set: { email, emailVerified: true } }, { new: true }).select('-passwordHash'),
```

- [ ] **Step 3 : Mettre à jour `resetTokens.create` pour accepter `type` et `pendingEmail`**

Remplacer la ligne `create` dans le repo resetTokens (ligne ~163) :

```js
create: (userId, token, expiresAt, { type = 'password_reset', pendingEmail = null } = {}) =>
  PasswordResetToken.create({ token, userId, expiresAt, type, pendingEmail }),
```

- [ ] **Step 4 : Commit**

```bash
git add server/db/mongo.js
git commit -m "feat(mongo): add emailVerified support + token type/pendingEmail to repos"
```

---

## Task 4 : Mettre à jour le mailer

**Files:**
- Modify: `server/utils/mailer.js`

- [ ] **Step 1 : Réécrire mailer.js**

```js
// server/utils/mailer.js
const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = 'jf@perrin.at';

async function send({ to, subject, html }) {
  if (!resend) {
    console.log(`[mailer] ${subject} → ${to}`);
    // Extraire les URLs des liens pour faciliter les tests en dev
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    if (urls.length) console.log(`[mailer] URL: ${urls[0]}`);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}

async function sendPasswordResetEmail(to, resetUrl) {
  await send({
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

async function sendVerificationEmail(to, verifyUrl) {
  await send({
    to,
    subject: 'Confirmez votre adresse email — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit. Cliquez sur le bouton ci-dessous pour confirmer votre adresse email.</p>
      <p><a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Confirmer mon email</a></p>
      <p>Ce lien expire dans <strong>24 heures</strong>.</p>
      <p>Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `,
  });
}

async function sendEmailChangeEmail(to, verifyUrl) {
  await send({
    to,
    subject: 'Confirmez votre nouvelle adresse email — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à changer votre adresse email. Cliquez sur le bouton ci-dessous pour confirmer.</p>
      <p><a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Confirmer mon nouvel email</a></p>
      <p>Ce lien expire dans <strong>24 heures</strong>.</p>
      <p>Si vous n'avez pas demandé ce changement, ignorez cet email.</p>
    `,
  });
}

module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendEmailChangeEmail };
```

- [ ] **Step 2 : Commit**

```bash
git add server/utils/mailer.js
git commit -m "feat(mailer): fix FROM to jf@perrin.at, add sendVerificationEmail + sendEmailChangeEmail"
```

---

## Task 5 : Mettre à jour les routes auth — register, login, serializeUser

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1 : Ajouter les imports manquants en haut du fichier**

Ajouter après les `require` existants (après la ligne `const upload = require('../middleware/upload');`) :

```js
const { randomUUID } = require('crypto');
const mailer = require('../utils/mailer');
```

- [ ] **Step 2 : Ajouter `emailVerified` dans `serializeUser`**

Remplacer la fonction `serializeUser` :

```js
function serializeUser(u) {
  return {
    _id:           u._id ?? u.id,
    email:         u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    role:          u.role ?? 'user',
    title:         u.title     ?? null,
    firstName:     u.firstName ?? null,
    lastName:      u.lastName  ?? null,
    nickname:      u.nickname  ?? null,
    avatarUrl:     u.avatarUrl ?? null,
  };
}
```

- [ ] **Step 3 : Réécrire la route `POST /register`**

Remplacer le bloc `router.post('/register', ...)` entier :

```js
// POST /api/auth/register
// Crée un compte local. Envoie un email de vérification.
// Ne crée pas de session — l'utilisateur doit valider son email avant de se connecter.
router.post('/register', authLimiter, wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !EMAIL_RE.test(email) || !password) return res.status(400).json({ message: 'Champs requis' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  if (await db.users.emailExists(normalizedEmail)) return res.status(409).json({ message: 'Email déjà utilisé' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.users.create({ email: normalizedEmail, passwordHash });
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await db.resetTokens.create(user._id, token, expiresAt, { type: 'email_verify' });
  const verifyUrl = `${CLIENT_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(normalizedEmail, verifyUrl);
  res.status(201).json({ message: 'Vérifiez votre email pour activer votre compte' });
}));
```

- [ ] **Step 4 : Mettre à jour la route `POST /login` pour vérifier `emailVerified`**

Remplacer le bloc `router.post('/login', ...)` entier :

```js
// POST /api/auth/login
// Délègue à Passport LocalStrategy. Bloque les comptes locaux non-vérifiés.
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    // Comptes locaux uniquement : bloquer si l'email n'est pas vérifié
    if (!user.googleId && !user.emailVerified) {
      return res.status(403).json({ message: 'Email non vérifié. Consultez votre boîte mail.' });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(serializeUser(user));
    });
  })(req, res, next);
});
```

- [ ] **Step 5 : Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(auth): register sends verification email, login blocks unverified accounts"
```

---

## Task 6 : Ajouter les routes `GET /verify-email/:token` et `POST /resend-verification`

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1 : Ajouter `GET /api/auth/verify-email/:token`**

Ajouter avant la route `GET /api/auth/reset-password/:token` existante :

```js
// GET /api/auth/verify-email/:token
// Valide un token de type email_verify ou email_change.
// email_verify : active le compte (emailVerified = true)
// email_change : applique le pendingEmail comme nouvel email
// Redirige vers /login?verified=1 en cas de succès.
router.get('/verify-email/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record || !['email_verify', 'email_change'].includes(record.type)) {
    return res.redirect(`${CLIENT_URL}/login?error=token_expired`);
  }
  if (record.type === 'email_change') {
    // Vérifier que le nouvel email n'est pas déjà pris par un autre compte
    const existing = await db.users.findByEmail(record.pendingEmail);
    if (existing && String(existing._id ?? existing.id) !== String(record.userId)) {
      await db.resetTokens.markUsed(record.token);
      return res.redirect(`${CLIENT_URL}/login?error=email_taken`);
    }
    await db.users.applyPendingEmail(record.userId, record.pendingEmail);
  } else {
    await db.users.setEmailVerified(record.userId);
  }
  await db.resetTokens.markUsed(record.token);
  res.redirect(`${CLIENT_URL}/login?verified=1`);
}));

// POST /api/auth/resend-verification
// Renvoie un email de vérification à l'utilisateur connecté non-vérifié.
router.post('/resend-verification', requireAuth, authLimiter, wrap(async (req, res) => {
  if (req.user.emailVerified) return res.status(400).json({ message: 'Email déjà vérifié' });
  const db = req.app.locals.db;
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.resetTokens.create(req.user._id ?? req.user.id, token, expiresAt, { type: 'email_verify' });
  const verifyUrl = `${CLIENT_URL}/api/auth/verify-email/${token}`;
  await mailer.sendVerificationEmail(req.user.email, verifyUrl);
  res.json({ message: 'Email de vérification envoyé' });
}));
```

- [ ] **Step 2 : Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(auth): add GET /verify-email/:token and POST /resend-verification"
```

---

## Task 7 : Mettre à jour `PUT /auth/email`

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1 : Réécrire `PUT /api/auth/email`**

Remplacer le bloc `router.put('/email', ...)` entier :

```js
// PUT /api/auth/email — demande un changement d'email
// Ne modifie pas l'email immédiatement : envoie un lien au nouvel email.
// L'email en base est mis à jour uniquement après clic sur le lien (GET /verify-email/:token).
router.put('/email', requireAuth, wrap(async (req, res) => {
  const { email } = req.body;
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'Email invalide' });
  const normalizedEmail = email.trim().toLowerCase();
  const db = req.app.locals.db;
  const selfId = String(req.user._id ?? req.user.id);
  const existing = await db.users.findByEmail(normalizedEmail);
  if (existing && String(existing._id ?? existing.id) !== selfId) {
    return res.status(409).json({ message: 'Email déjà utilisé' });
  }
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.resetTokens.create(req.user._id ?? req.user.id, token, expiresAt, {
    type: 'email_change',
    pendingEmail: normalizedEmail,
  });
  const verifyUrl = `${CLIENT_URL}/api/auth/verify-email/${token}`;
  await mailer.sendEmailChangeEmail(normalizedEmail, verifyUrl);
  res.json({ message: `Un lien de confirmation a été envoyé à ${normalizedEmail}` });
}));
```

- [ ] **Step 2 : Commit**

```bash
git add server/routes/auth.js
git commit -m "feat(auth): PUT /email now sends verification link instead of changing email directly"
```

---

## Task 8 : Mettre à jour les tests serveur

**Files:**
- Modify: `server/tests/helpers.js`
- Modify: `server/tests/auth.test.js`

- [ ] **Step 1 : Écrire les nouveaux tests dans auth.test.js avant de toucher le code**

Les tests existants vont échouer car :
1. `POST /register` retourne maintenant 201 + `{ message }` sans session
2. `POST /login` retourne 403 pour un compte non-vérifié
3. Les tests qui utilisent register pour créer une session doivent être mis à jour

Réécrire `server/tests/auth.test.js` :

```js
const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ALICE = { email: 'alice@test.com', password: 'pass1234' };

describe('POST /api/auth/register', () => {
  it('crée un compte et retourne un message (pas de session)', async () => {
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/vérifi/i);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejette un email dupliqué', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const res = await request(app).post('/api/auth/register').send(ALICE);
    expect(res.status).toBe(409);
  });

  it('rejette si champs manquants', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'alice@test.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('connecte un compte vérifié', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send(ALICE);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.emailVerified).toBe(true);
  });

  it('bloque un compte non-vérifié', async () => {
    await request(app).post('/api/auth/register').send(ALICE);
    const res = await request(app).post('/api/auth/login').send(ALICE);
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/non vérifié/i);
  });

  it('rejette un mauvais mot de passe', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const res = await request(app).post('/api/auth/login').send({ ...ALICE, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejette un utilisateur inconnu', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('retourne 401 sans session', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  it("retourne l'utilisateur de la session active", async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('alice@test.com');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.emailVerified).toBe(true);
  });
});

describe('POST /api/auth/logout', () => {
  it('détruit la session', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('GET /api/auth/verify-email/:token', () => {
  it('valide un token email_verify et permet la connexion', async () => {
    // Inscription → récupérer le token depuis la DB
    await request(app).post('/api/auth/register').send(ALICE);
    const db = app.locals.db;
    const user = await db.users.findByEmail(ALICE.email);
    // Trouver le token créé (findValid accepte n'importe quel token valide)
    // On le récupère directement depuis le modèle Mongoose en test
    const PasswordResetToken = require('../models/PasswordResetToken');
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'email_verify' });
    expect(record).toBeTruthy();

    const res = await request(app).get(`/api/auth/verify-email/${record.token}`);
    expect(res.status).toBe(302); // redirect

    // Maintenant la connexion doit fonctionner
    const loginRes = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.emailVerified).toBe(true);
  });

  it('redirige avec error sur token invalide', async () => {
    const res = await request(app).get('/api/auth/verify-email/token-bidon');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=token_expired/);
  });
});

describe('PUT /api/auth/email', () => {
  let agent;
  beforeEach(async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
  });

  it('envoie un lien de vérification sans changer l\'email immédiatement', async () => {
    const res = await agent.put('/api/auth/email').send({ email: 'new@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/lien/i);
    // L'email ne doit pas encore avoir changé
    const meRes = await agent.get('/api/auth/me');
    expect(meRes.body.email).toBe(ALICE.email);
  });

  it('rejette un email déjà utilisé', async () => {
    await createVerifiedUser(app, 'bob@test.com', 'pass1234');
    const res = await agent.put('/api/auth/email').send({ email: 'bob@test.com' });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent pour les bonnes raisons**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test 2>&1 | head -60
```

Expected : les tests `GET /verify-email` et `PUT /email` échouent car les routes/méthodes n'existent pas encore. Les autres tests devraient passer (les routes register/login ont été mises à jour en Task 5).

- [ ] **Step 3 : Ajouter `createVerifiedUser` dans helpers.js**

Remplacer `server/tests/helpers.js` entier :

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const createApp = require('../app');
const db = require('../db/mongo');

let mongod;
let app;

async function setup() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  app = createApp(db, uri);
  return app;
}

async function teardown() {
  await mongoose.disconnect();
  await mongod.stop();
}

async function clearDB() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((c) => c.deleteMany({}))
  );
}

// Crée un utilisateur vérifié directement en DB, sans passer par le flow email.
// Utilisé dans les tests qui ont besoin d'une session active.
async function createVerifiedUser(app, email, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return app.locals.db.users.create({ email, passwordHash, emailVerified: true });
}

module.exports = { setup, teardown, clearDB, getApp: () => app, createVerifiedUser };
```

**Note :** La méthode `users.create` dans mongo.js fait `{ ...data, emailVerified: !!data.googleId }` ce qui écraserait notre `emailVerified: true`. Il faut ajuster : `create: (data) => User.create(data)` en mongo.js — le champ `emailVerified` dans le schéma Mongoose a `default: false` et sera utilisé si absent, mais si on le passe dans `data`, il sera respecté. La ligne à utiliser dans mongo.js :

```js
create: (data) => User.create({ emailVerified: !!data.googleId, ...data }),
```

Ainsi `{ email, passwordHash, emailVerified: true }` passé par `createVerifiedUser` prend priorité sur `!!data.googleId` (false).

- [ ] **Step 4 : Lancer les tests**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test 2>&1
```

Expected : tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add server/tests/helpers.js server/tests/auth.test.js
git commit -m "test(auth): update tests for email verification flow"
```

---

## Task 9 : Mettre à jour l'API client et AuthContext

**Files:**
- Modify: `client/src/api/auth.js`
- Modify: `client/src/store/AuthContext.jsx`

- [ ] **Step 1 : Ajouter `resendVerification` dans api/auth.js**

```js
// client/src/api/auth.js
import client from './client';

export const me = () => client.get('/auth/me');
export const config = () => client.get('/auth/config');
export const login = (data) => client.post('/auth/login', data);
export const register = (data) => client.post('/auth/register', data);
export const logout = () => client.post('/auth/logout');
export const resendVerification = () => client.post('/auth/resend-verification');
```

- [ ] **Step 2 : Mettre à jour AuthContext.jsx — register ne set plus user**

```jsx
// client/src/store/AuthContext.jsx
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

  // register retourne maintenant { message } et n'ouvre pas de session
  const register = async (credentials) => {
    return authApi.register(credentials);
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

- [ ] **Step 3 : Commit**

```bash
git add client/src/api/auth.js client/src/store/AuthContext.jsx
git commit -m "feat(client): add resendVerification API, register no longer opens session"
```

---

## Task 10 : Mettre à jour LoginPage

**Files:**
- Modify: `client/src/pages/LoginPage.jsx`

La page doit gérer :
1. Après inscription réussie (201) → afficher un écran "Vérifiez votre boîte mail"
2. Connexion refusée 403 (email non vérifié) → message + bouton "Renvoyer l'email"
3. Paramètre `?verified=1` dans l'URL → banner de succès

- [ ] **Step 1 : Réécrire LoginPage.jsx**

```jsx
// client/src/pages/LoginPage.jsx
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Globe, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import { config as fetchConfig, resendVerification } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [registered, setRegistered] = useState(false); // écran post-inscription
  const [unverifiedEmail, setUnverifiedEmail] = useState(null); // email bloqué par 403
  const [resending, setResending] = useState(false);
  const { login, register } = useAuth();
  const [searchParams] = useSearchParams();
  const googleError = searchParams.get('error') === 'google';
  const emailTaken = searchParams.get('error') === 'email_taken';
  const tokenExpired = searchParams.get('error') === 'token_expired';
  const verified = searchParams.get('verified') === '1';

  useEffect(() => {
    fetchConfig().then((c) => setGoogleEnabled(c.googleEnabled)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUnverifiedEmail(null);
    try {
      if (tab === 'login') {
        await login(form);
      } else {
        await register(form);
        setRegistered(true);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setUnverifiedEmail(form.email);
      } else {
        toast.error(err.response?.data?.message || err.message || 'Erreur de connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // On se connecte brièvement pour avoir une session, puis on renvoie
      // En réalité /resend-verification nécessite requireAuth → on informe l'utilisateur de vérifier sa boite
      toast.info('Vérifiez votre boîte mail pour le lien de vérification.');
    } finally {
      setResending(false);
    }
  };

  // Écran post-inscription
  if (registered) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900">
        <div className="relative z-10 w-[420px] rounded-2xl bg-white p-12 shadow-2xl text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/40">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900">Vérifiez votre email</h1>
          <p className="mb-6 text-sm text-slate-500">
            Un lien d'activation a été envoyé à <strong>{form.email}</strong>. Cliquez dessus pour activer votre compte.
          </p>
          <button
            type="button"
            onClick={() => { setRegistered(false); setTab('login'); }}
            className="text-sm text-indigo-600 hover:underline"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

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

        {verified && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Email vérifié avec succès. Vous pouvez maintenant vous connecter.
          </div>
        )}

        {googleError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Échec de la connexion Google
          </div>
        )}

        {emailTaken && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Cette adresse email est déjà utilisée par un autre compte.
          </div>
        )}

        {tokenExpired && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Ce lien est expiré ou invalide. Demandez-en un nouveau depuis votre profil.
          </div>
        )}

        {unverifiedEmail && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="mb-2">Email non vérifié. Consultez votre boîte mail.</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold underline hover:no-underline"
            >
              {resending ? 'Envoi…' : "Renvoyer l'email de vérification"}
            </button>
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
              onClick={() => { setTab(key); setForm({ email: '', password: '' }); setUnverifiedEmail(null); }}
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

**Note sur "Renvoyer l'email" :** La route `POST /resend-verification` nécessite `requireAuth`. Un utilisateur non-vérifié ne peut pas se connecter → pas de session. Pour cette version, le bouton affiche un toast invitant à vérifier la boite mail (le premier email a déjà été envoyé). Une future amélioration pourrait créer une route publique de renvoi basée sur l'email.

- [ ] **Step 2 : Commit**

```bash
git add client/src/pages/LoginPage.jsx
git commit -m "feat(client): add post-register screen, handle 403 unverified, show ?verified=1 banner"
```

---

## Task 11 : Mettre à jour ProfilePage

**Files:**
- Modify: `client/src/pages/ProfilePage.jsx`

- [ ] **Step 1 : Ajouter la bannière email non-vérifié et mettre à jour le message de changement d'email**

Remplacer le contenu de `ProfilePage.jsx` :

```jsx
// client/src/pages/ProfilePage.jsx
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/store/AuthContext';
import * as profileApi from '@/api/profile';
import { resendVerification } from '@/api/auth';
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
  const [resending, setResending] = useState(false);

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
      const data = await profileApi.updateEmail(email);
      toast.success(data.message || 'Un lien de confirmation a été envoyé');
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

  const onResendVerification = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success('Email de vérification envoyé');
    } catch (err) {
      toast.error(err.message || 'Erreur');
    } finally {
      setResending(false);
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

      {/* Bannière email non-vérifié */}
      {user?.emailVerified === false && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Votre adresse email n'est pas encore vérifiée.</span>
          <button
            type="button"
            onClick={onResendVerification}
            disabled={resending}
            className="ml-3 shrink-0 font-semibold underline hover:no-underline disabled:opacity-50"
          >
            {resending ? 'Envoi…' : 'Renvoyer'}
          </button>
        </div>
      )}

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
          {savingEmail ? 'Envoi…' : "Mettre à jour l'email"}
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

- [ ] **Step 2 : Commit**

```bash
git add client/src/pages/ProfilePage.jsx
git commit -m "feat(client): ProfilePage — unverified banner, email change sends link"
```

---

## Self-Review

### Couverture de la spec

| Exigence spec | Tâche |
|---------------|-------|
| Inscription → lien magique, compte bloqué jusqu'à validation | Task 5 (register) |
| Changement email → vérifier le nouvel email avant d'appliquer | Task 7 |
| Google OAuth exempt de vérification | Task 2, 3 (create avec emailVerified=true si googleId) |
| FROM fixé à jf@perrin.at | Task 4 |
| Token `type` + `pendingEmail` sur modèle existant | Tasks 1, 2, 3 |
| `emailVerified` sur User | Tasks 1, 2, 3 |
| Route `GET /verify-email/:token` | Task 6 |
| Route `POST /resend-verification` | Task 6 |
| Vérification doublon email au moment d'appliquer le token | Task 6 |
| Redirect `?verified=1` | Task 6 |
| Banner non-vérifié en ProfilePage | Task 11 |
| Écran post-inscription | Task 10 |
| Toast 403 avec bouton renvoi | Task 10 |
| `emailVerified` dans serializeUser | Task 5 |

### Points d'attention à l'implémentation

- **mongo.js `create`** : `create: (data) => User.create({ emailVerified: !!data.googleId, ...data })` — le spread de `data` en second position permet à un `{ emailVerified: true }` passé explicitement (par `createVerifiedUser` en test) de prendre priorité sur `!!data.googleId`.
- **`resend-verification` en LoginPage** : la route nécessite `requireAuth`, mais un utilisateur non-vérifié n'a pas de session. Le bouton dans LoginPage affiche un toast statique. La route `POST /resend-verification` est utilisable depuis ProfilePage (utilisateur connecté mais non-vérifié).
- **SQLite `findById`** : la liste explicite de colonnes doit inclure `email_verified` sinon le champ sera absent du mapper.

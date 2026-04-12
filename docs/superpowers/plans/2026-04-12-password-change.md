# Password Change with Cancel Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow authenticated users to change their password from the Profile page, with an email notification containing a 12-hour cancellation link that restores the old password.

**Architecture:** Reuses the existing `resetTokens` infrastructure (token creation, `findValid`, `markUsed`) with a new `password_change_cancel` type that stores the old `passwordHash`. Two new server routes handle the change and the cancel. A new form section in `ProfilePage` drives the client UX.

**Tech Stack:** Express 5, bcryptjs, better-sqlite3 / Mongoose, Resend (via `mailer.js`), React + shadcn/ui

---

## File Map

| File | Change |
|------|--------|
| `server/models/PasswordResetToken.js` | Add `oldPasswordHash` field + `password_change_cancel` to enum |
| `server/db/mongo.js` | Update `resetTokens.create` to accept + persist `oldPasswordHash` |
| `server/db/sqlite.js` | Migration + `mapResetToken` + `resetTokens.create` for `oldPasswordHash` |
| `server/utils/mailer.js` | Add `sendPasswordChangeEmail` |
| `server/routes/auth.js` | Add `PUT /password` and `GET /cancel-password-change/:token` |
| `server/tests/auth.test.js` | Tests for both new routes |
| `client/src/api/profile.js` | Add `changePassword` |
| `client/src/pages/ProfilePage.jsx` | Add password change form section |
| `client/src/pages/LoginPage.jsx` | Add `password_cancelled` banner |

---

## Task 1 — Schema: PasswordResetToken + SQLite migration

**Files:**
- Modify: `server/models/PasswordResetToken.js`
- Modify: `server/db/mongo.js`
- Modify: `server/db/sqlite.js`

- [ ] **Step 1: Update the Mongoose schema**

In `server/models/PasswordResetToken.js`, replace the existing content with:

```js
const { Schema, model } = require('mongoose');

const schema = new Schema({
  token:           { type: String, required: true, unique: true },
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type:            { type: String, enum: ['password_reset', 'email_verify', 'email_change', 'password_change_cancel'], default: 'password_reset' },
  pendingEmail:    { type: String, trim: true },
  oldPasswordHash: { type: String },
  expiresAt:       { type: Date, required: true },
  used:            { type: Boolean, default: false },
}, { timestamps: true });

module.exports = model('PasswordResetToken', schema);
```

- [ ] **Step 2: Update `resetTokens.create` in `server/db/mongo.js`**

Find this line (around line 169):
```js
  create: (userId, token, expiresAt, { type = 'password_reset', pendingEmail = null } = {}) =>
    PasswordResetToken.create({ token, userId, expiresAt, type, pendingEmail }),
```

Replace with:
```js
  create: (userId, token, expiresAt, { type = 'password_reset', pendingEmail = null, oldPasswordHash = null } = {}) =>
    PasswordResetToken.create({ token, userId, expiresAt, type, pendingEmail, oldPasswordHash }),
```

- [ ] **Step 3: Add SQLite migration for `old_password_hash` column**

In `server/db/sqlite.js`, find the migrations loop (around line 94) that contains entries like `'ALTER TABLE password_reset_tokens ADD COLUMN pending_email TEXT'`. Add one more entry at the end of that array:

```js
    'ALTER TABLE password_reset_tokens ADD COLUMN old_password_hash TEXT',
```

The full array should now end with:
```js
    "ALTER TABLE password_reset_tokens ADD COLUMN type TEXT NOT NULL DEFAULT 'password_reset'",
    'ALTER TABLE password_reset_tokens ADD COLUMN pending_email TEXT',
    'ALTER TABLE password_reset_tokens ADD COLUMN old_password_hash TEXT',
```

- [ ] **Step 4: Update `mapResetToken` in `server/db/sqlite.js`**

Find `mapResetToken` (around line 164):
```js
const mapResetToken = (row) => row && {
  _id:          row.id,
  token:        row.token,
  userId:       row.user_id,
  expiresAt:    new Date(row.expires_at),
  used:         row.used === 1,
  type:         row.type ?? 'password_reset',
  pendingEmail: row.pending_email ?? null,
};
```

Replace with:
```js
const mapResetToken = (row) => row && {
  _id:             row.id,
  token:           row.token,
  userId:          row.user_id,
  expiresAt:       new Date(row.expires_at),
  used:            row.used === 1,
  type:            row.type ?? 'password_reset',
  pendingEmail:    row.pending_email ?? null,
  oldPasswordHash: row.old_password_hash ?? null,
};
```

- [ ] **Step 5: Update `resetTokens.create` in `server/db/sqlite.js`**

Find the SQLite `resetTokens.create` method (around line 496):
```js
    create(userId, token, expiresAt, { type = 'password_reset', pendingEmail = null } = {}) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO password_reset_tokens (id, token, user_id, expires_at, type, pending_email) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, token, uid(userId), expiresAt.toISOString(), type, pendingEmail ?? null);
      return mapResetToken(db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id));
    },
```

Replace with:
```js
    create(userId, token, expiresAt, { type = 'password_reset', pendingEmail = null, oldPasswordHash = null } = {}) {
      const id = randomUUID();
      db.prepare(
        'INSERT INTO password_reset_tokens (id, token, user_id, expires_at, type, pending_email, old_password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(id, token, uid(userId), expiresAt.toISOString(), type, pendingEmail ?? null, oldPasswordHash ?? null);
      return mapResetToken(db.prepare('SELECT * FROM password_reset_tokens WHERE id = ?').get(id));
    },
```

- [ ] **Step 6: Commit**

```bash
git add server/models/PasswordResetToken.js server/db/mongo.js server/db/sqlite.js
git commit -m "feat: add oldPasswordHash field and password_change_cancel token type"
```

---

## Task 2 — Mailer: sendPasswordChangeEmail

**Files:**
- Modify: `server/utils/mailer.js`

- [ ] **Step 1: Add the function**

In `server/utils/mailer.js`, add the following before the `module.exports` line:

```js
async function sendPasswordChangeEmail(to, cancelUrl) {
  await send({
    to,
    subject: 'Votre mot de passe a été modifié — Comptes',
    html: `
      <p>Bonjour,</p>
      <p>Le mot de passe de votre compte a été modifié.</p>
      <p>Si vous êtes à l'origine de ce changement, ignorez cet email.</p>
      <p>Dans le cas contraire, annulez le changement en cliquant ci-dessous :</p>
      <p><a href="${cancelUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Annuler le changement de mot de passe</a></p>
      <p>Ce lien expire dans <strong>12 heures</strong>.</p>
    `,
  });
}
```

- [ ] **Step 2: Export the function**

Update the `module.exports` line at the bottom:
```js
module.exports = { sendPasswordResetEmail, sendVerificationEmail, sendEmailChangeEmail, sendPasswordChangeEmail };
```

- [ ] **Step 3: Commit**

```bash
git add server/utils/mailer.js
git commit -m "feat: add sendPasswordChangeEmail to mailer"
```

---

## Task 3 — Server routes: PUT /password + GET /cancel-password-change/:token

**Files:**
- Modify: `server/routes/auth.js`

- [ ] **Step 1: Add the two routes**

In `server/routes/auth.js`, add the following two routes before the `module.exports = router;` line:

```js
// PUT /api/auth/password — change le mot de passe de l'utilisateur connecté
// Vérifie le mot de passe actuel, enregistre le nouveau, envoie un email avec lien d'annulation.
router.put('/password', requireAuth, authLimiter, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }
  const db = req.app.locals.db;
  const userWithHash = await db.users.findByIdWithHash(req.user._id ?? req.user.id);
  if (!userWithHash.passwordHash) {
    return res.status(400).json({ message: 'Compte Google, changement de mot de passe non disponible' });
  }
  const valid = await bcrypt.compare(currentPassword ?? '', userWithHash.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Mot de passe actuel incorrect' });

  const oldPasswordHash = userWithHash.passwordHash;
  const newHash = await bcrypt.hash(newPassword, 12);
  await db.users.setPassword(req.user._id ?? req.user.id, newHash);

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h
  await db.resetTokens.create(req.user._id ?? req.user.id, token, expiresAt, {
    type: 'password_change_cancel',
    oldPasswordHash,
  });
  const cancelUrl = `${SERVER_URL}/api/auth/cancel-password-change/${token}`;
  await mailer.sendPasswordChangeEmail(req.user.email, cancelUrl);
  res.json({ message: 'Mot de passe mis à jour' });
}));

// GET /api/auth/cancel-password-change/:token — annule un changement de mot de passe
// Restaure l'ancien hash, invalide le token, redirige vers /login?password_cancelled=1.
router.get('/cancel-password-change/:token', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const record = await db.resetTokens.findValid(req.params.token);
  if (!record || record.type !== 'password_change_cancel') {
    return res.redirect(`${CLIENT_URL}/login?error=token_expired`);
  }
  await db.users.setPassword(record.userId, record.oldPasswordHash);
  await db.resetTokens.markUsed(record.token);
  res.redirect(`${CLIENT_URL}/login?password_cancelled=1`);
}));
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/auth.js
git commit -m "feat: add PUT /password and GET /cancel-password-change routes"
```

---

## Task 4 — Tests: PUT /password + GET /cancel-password-change

**Files:**
- Modify: `server/tests/auth.test.js`

- [ ] **Step 1: Write the failing tests**

Add the following two `describe` blocks at the end of `server/tests/auth.test.js` (before the end of the file):

```js
describe('PUT /api/auth/password', () => {
  let agent;
  beforeEach(async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
  });

  it('retourne 401 sans session', async () => {
    const res = await request(app).put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(401);
  });

  it('retourne 400 si nouveau mot de passe trop court', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'abc',
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 caractères/);
  });

  it('retourne 401 si mot de passe actuel incorrect', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: 'wrongpassword',
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  it('change le mot de passe et crée un token d\'annulation', async () => {
    const res = await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/mis à jour/i);

    // Le nouveau mot de passe fonctionne
    const loginNew = await request(app).post('/api/auth/login').send({
      email: ALICE.email,
      password: 'newpass1234',
    });
    expect(loginNew.status).toBe(200);

    // L'ancien mot de passe ne fonctionne plus
    const loginOld = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginOld.status).toBe(401);

    // Un token password_change_cancel a été créé
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });
    expect(record).toBeTruthy();
    expect(record.oldPasswordHash).toBeTruthy();
  });
});

describe('GET /api/auth/cancel-password-change/:token', () => {
  it('redirige avec token_expired si token invalide', async () => {
    const res = await request(app).get('/api/auth/cancel-password-change/bidon');
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/error=token_expired/);
  });

  it('restaure l\'ancien mot de passe et redirige avec password_cancelled=1', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);

    // Changer le mot de passe pour créer le token d'annulation
    await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });

    // Récupérer le token depuis la DB
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });

    // Annuler le changement
    const res = await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/password_cancelled=1/);

    // L'ancien mot de passe fonctionne à nouveau
    const loginOld = await request(app).post('/api/auth/login').send(ALICE);
    expect(loginOld.status).toBe(200);

    // Le nouveau mot de passe ne fonctionne plus
    const loginNew = await request(app).post('/api/auth/login').send({
      email: ALICE.email,
      password: 'newpass1234',
    });
    expect(loginNew.status).toBe(401);
  });

  it('rejette un token déjà utilisé', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    await agent.put('/api/auth/password').send({
      currentPassword: ALICE.password,
      newPassword: 'newpass1234',
    });
    const PasswordResetToken = require('../models/PasswordResetToken');
    const user = await app.locals.db.users.findByEmail(ALICE.email);
    const record = await PasswordResetToken.findOne({ userId: user._id, type: 'password_change_cancel' });

    // Premier clic : OK
    await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    // Deuxième clic : token marqué used → token_expired
    const res2 = await request(app).get(`/api/auth/cancel-password-change/${record.token}`);
    expect(res2.status).toBe(302);
    expect(res2.headers.location).toMatch(/error=token_expired/);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd server && yarn test tests/auth.test.js 2>&1 | tail -40
```

Expected: all tests PASS (routes were added in Task 3, schema in Task 1). If any fail, diagnose before continuing.

- [ ] **Step 3: Commit**

```bash
git add server/tests/auth.test.js
git commit -m "test: add tests for PUT /password and GET /cancel-password-change"
```

---

## Task 5 — Client: changePassword API + ProfilePage form section

**Files:**
- Modify: `client/src/api/profile.js`
- Modify: `client/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Add changePassword to the API layer**

In `client/src/api/profile.js`, add at the end:

```js
export const changePassword = (currentPassword, newPassword) =>
  client.put('/auth/password', { currentPassword, newPassword });
```

- [ ] **Step 2: Add state and handler to ProfilePage**

In `client/src/pages/ProfilePage.jsx`, add the import for `changePassword`:

```js
import * as profileApi from '@/api/profile';
```
(already imported — no change needed, `changePassword` is in the same module)

Add these state variables after the existing `const [resending, setResending] = useState(false);` line:

```js
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
```

Add this handler after the `onResendVerification` function:

```js
  const onChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordForm.next.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères');
      return;
    }
    setSavingPassword(true);
    try {
      await profileApi.changePassword(passwordForm.current, passwordForm.next);
      toast.success('Mot de passe mis à jour. Un email de confirmation vous a été envoyé.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error('Mot de passe actuel incorrect');
      } else {
        toast.error(err.response?.data?.message || err.message || 'Erreur');
      }
    } finally {
      setSavingPassword(false);
    }
  };
```

- [ ] **Step 3: Add the password change form section**

In `ProfilePage.jsx`, insert the following JSX block between the Email section (`</form>` closing the email form) and the Profil section (`{/* Profil */}`):

```jsx
      {/* Mot de passe */}
      <form onSubmit={onChangePassword} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-xs">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Mot de passe actuel</Label>
          <Input
            id="currentPassword"
            type="password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm((f) => ({ ...f, current: e.target.value }))}
            autoComplete="current-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nouveau mot de passe</Label>
          <Input
            id="newPassword"
            type="password"
            value={passwordForm.next}
            onChange={(e) => setPasswordForm((f) => ({ ...f, next: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={passwordForm.confirm}
            onChange={(e) => setPasswordForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={savingPassword} className="w-full">
          {savingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
        </Button>
      </form>
```

- [ ] **Step 4: Commit**

```bash
git add client/src/api/profile.js client/src/pages/ProfilePage.jsx
git commit -m "feat: add password change form to ProfilePage"
```

---

## Task 6 — Client: LoginPage banner for password_cancelled

**Files:**
- Modify: `client/src/pages/LoginPage.jsx`

- [ ] **Step 1: Add the password_cancelled flag**

In `client/src/pages/LoginPage.jsx`, find the block of `searchParams.get(...)` variables (around lines 21–24):

```js
  const googleError = searchParams.get('error') === 'google';
  const emailTaken = searchParams.get('error') === 'email_taken';
  const tokenExpired = searchParams.get('error') === 'token_expired';
  const verified = searchParams.get('verified') === '1';
```

Add one line after `verified`:
```js
  const passwordCancelled = searchParams.get('password_cancelled') === '1';
```

- [ ] **Step 2: Render the banner**

In the JSX, after the existing `{verified && (...)}` banner block (around line 89), add:

```jsx
        {passwordCancelled && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Votre changement de mot de passe a été annulé. Vous pouvez vous connecter avec votre ancien mot de passe.
          </div>
        )}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/LoginPage.jsx
git commit -m "feat: add password_cancelled banner to LoginPage"
```

---

## Task 7 — Verification finale

- [ ] **Step 1: Lancer tous les tests serveur**

```bash
cd server && yarn test 2>&1 | tail -50
```

Expected: all test suites PASS with no failures.

- [ ] **Step 2: Lancer le serveur et le client en dev**

```bash
# Terminal 1 (repo root)
yarn dev
```

- [ ] **Step 3: Tester le flux complet manuellement**

1. Connectez-vous avec un compte existant (email + mot de passe)
2. Allez sur `/profile`
3. Remplissez la section "Mot de passe" : mot de passe actuel, nouveau, confirmation
4. Cliquez "Changer le mot de passe"
5. Vérifiez le toast de succès
6. Déconnectez-vous
7. Vérifiez que l'ancien mot de passe ne fonctionne plus (401)
8. Vérifiez que le nouveau mot de passe fonctionne (200)
9. Dans les logs dev, repérez la ligne `[mailer] URL: http://localhost:3001/api/auth/cancel-password-change/<token>`
10. Visitez cette URL dans le navigateur
11. Vérifiez la redirection vers `/login?password_cancelled=1` et la bannière verte
12. Vérifiez que l'ancien mot de passe fonctionne à nouveau

- [ ] **Step 4: Tester les cas d'erreur**

- Mauvais mot de passe actuel → toast "Mot de passe actuel incorrect"
- Confirmation ne correspond pas → toast "Les mots de passe ne correspondent pas"
- Nouveau mot de passe < 8 caractères → toast "Le mot de passe doit faire au moins 8 caractères"
- Token expiré ou bidon → redirect `/login?error=token_expired` + bannière amber existante

- [ ] **Step 5: Commit final si tout est OK**

```bash
git add -A
git status  # vérifier qu'aucun fichier indésirable n'est inclus
git commit -m "feat: password change complete — all tests passing"
```

# Admin Verify Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to manually mark a user's email as verified from the admin panel, exposing the verification status in the user list and adding a one-click verify button.

**Architecture:** Server adds `emailVerified` to the admin user serializer and a new idempotent `POST /api/admin/users/:id/verify-email` route reusing the existing `db.users.setEmailVerified` method. Client adds an icon button and a status badge in the user table.

**Tech Stack:** Express 5, Mongoose/SQLite, React, shadcn/ui, lucide-react, vitest + supertest

---

## File Map

| File | Change |
|------|--------|
| `server/tests/admin.test.js` | Create — tests for the new route + `emailVerified` in list |
| `server/routes/admin.js` | `serializeAdminUser` + `POST /users/:id/verify-email` route |
| `client/src/api/admin.js` | Add `verifyEmail` |
| `client/src/pages/AdminPage.jsx` | `handleVerify`, "Vérifié" column, `MailCheck` button |

---

## Task 1 — Write failing tests (TDD)

**Files:**
- Create: `server/tests/admin.test.js`

- [ ] **Step 1: Create the test file**

Create `server/tests/admin.test.js` with the following content:

```js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);
beforeEach(clearDB);

const ADMIN = { email: 'admin@test.com', password: 'adminpass1' };
const BOB   = { email: 'bob@test.com',   password: 'bobpass12'  };

// Crée un utilisateur admin vérifié directement en DB (comme createVerifiedUser dans helpers.js)
async function createAdminUser(app, email, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  return app.locals.db.users.create({ email, passwordHash, role: 'admin', emailVerified: true });
}

describe('GET /api/admin/users — emailVerified présent', () => {
  it('inclut emailVerified dans chaque utilisateur listé', async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);

    const passwordHash = await bcrypt.hash(BOB.password, 12);
    await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });

    const res = await adminAgent.get('/api/admin/users');
    expect(res.status).toBe(200);

    const bob = res.body.find(u => u.email === BOB.email);
    expect(bob).toBeTruthy();
    expect(bob.emailVerified).toBe(false);

    const admin = res.body.find(u => u.email === ADMIN.email);
    expect(admin.emailVerified).toBe(true);
  });
});

describe('POST /api/admin/users/:id/verify-email', () => {
  let adminAgent;
  beforeEach(async () => {
    await createAdminUser(app, ADMIN.email, ADMIN.password);
    adminAgent = request.agent(app);
    await adminAgent.post('/api/auth/login').send(ADMIN);
  });

  it('retourne 401 sans session', async () => {
    const passwordHash = await bcrypt.hash(BOB.password, 12);
    const bob = await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });
    const res = await request(app).post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(401);
  });

  it('retourne 403 pour un utilisateur sans rôle admin', async () => {
    await createVerifiedUser(app, BOB.email, BOB.password);
    const bobAgent = request.agent(app);
    await bobAgent.post('/api/auth/login').send(BOB);

    const bob = await app.locals.db.users.findByEmail(BOB.email);
    const res = await bobAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(403);
  });

  it('retourne 404 pour un utilisateur inexistant', async () => {
    const res = await adminAgent.post('/api/admin/users/000000000000000000000000/verify-email');
    expect(res.status).toBe(404);
  });

  it('marque l\'email comme vérifié et retourne l\'utilisateur mis à jour', async () => {
    const passwordHash = await bcrypt.hash(BOB.password, 12);
    const bob = await app.locals.db.users.create({ email: BOB.email, passwordHash, emailVerified: false });

    const res = await adminAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
    expect(res.body.email).toBe(BOB.email);
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('est idempotent — 200 même si déjà vérifié', async () => {
    const bob = await createVerifiedUser(app, BOB.email, BOB.password);
    const res = await adminAgent.post(`/api/admin/users/${bob._id}/verify-email`);
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && yarn test tests/admin.test.js 2>&1 | tail -30
```

Expected: tests fail — `GET /api/admin/users` doesn't return `emailVerified`, route `POST .../verify-email` doesn't exist (404 from Express).

- [ ] **Step 3: Commit the failing tests**

```bash
git add server/tests/admin.test.js
git commit -m "test: add failing tests for admin verify-email"
```

---

## Task 2 — Implement server route

**Files:**
- Modify: `server/routes/admin.js`

- [ ] **Step 1: Add `emailVerified` to `serializeAdminUser`**

Find `serializeAdminUser` at the top of `server/routes/admin.js`:

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

Replace with:

```js
function serializeAdminUser(u) {
  return {
    _id:           u._id ?? u.id,
    email:         u.email ?? null,
    emailVerified: u.emailVerified ?? false,
    role:          u.role ?? 'user',
    firstName:     u.firstName ?? null,
    lastName:      u.lastName ?? null,
    nickname:      u.nickname ?? null,
    createdAt:     u.createdAt ?? null,
  };
}
```

- [ ] **Step 2: Add the verify-email route**

In `server/routes/admin.js`, add the following route before `module.exports = router;`:

```js
// POST /api/admin/users/:id/verify-email — marque l'email d'un utilisateur comme vérifié
router.post('/users/:id/verify-email', wrap(async (req, res) => {
  const db = req.app.locals.db;
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' });
  const updated = await db.users.setEmailVerified(req.params.id);
  res.json(serializeAdminUser(updated));
}));
```

- [ ] **Step 3: Run tests to confirm they pass**

```bash
cd server && yarn test tests/admin.test.js 2>&1 | tail -20
```

Expected: `6 tests passed`.

- [ ] **Step 4: Run the full test suite to check for regressions**

```bash
cd server && yarn test 2>&1 | tail -15
```

Expected: all test files pass, total count increases by 6.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin.js
git commit -m "feat: add emailVerified to admin serializer and POST /users/:id/verify-email route"
```

---

## Task 3 — Client: API + AdminPage

**Files:**
- Modify: `client/src/api/admin.js`
- Modify: `client/src/pages/AdminPage.jsx`

- [ ] **Step 1: Add `verifyEmail` to the API layer**

In `client/src/api/admin.js`, add at the end:

```js
export const verifyEmail = (id) => api.post(`/admin/users/${id}/verify-email`);
```

- [ ] **Step 2: Update lucide-react imports in AdminPage**

In `client/src/pages/AdminPage.jsx`, find the import line:

```js
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck } from 'lucide-react';
```

Replace with:

```js
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, MailCheck, CheckCircle2, XCircle } from 'lucide-react';
```

- [ ] **Step 3: Add `handleVerify` handler**

In `AdminPage.jsx`, add the following function after the `handleReset` function:

```js
  const handleVerify = async (u) => {
    try {
      const updated = await adminApi.verifyEmail(u._id);
      setUsers(prev => prev.map(x => x._id === updated._id ? updated : x));
      toast.success(`Email de ${u.email} vérifié.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };
```

- [ ] **Step 4: Add "Vérifié" column header**

In `AdminPage.jsx`, find the `<thead>` row:

```jsx
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
```

Replace with:

```jsx
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Vérifié</th>
                <th className="px-4 py-3 text-left font-medium">Rôle</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
```

- [ ] **Step 5: Add verified badge cell in each row**

In `AdminPage.jsx`, find the `<tbody>` row content. After the hidden email `<td>`:

```jsx
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email ?? '—'}</td>
```

Add immediately after:

```jsx
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.emailVerified
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <XCircle className="h-4 w-4 text-amber-500" />
                    }
                  </td>
```

- [ ] **Step 6: Add verify button in actions**

In `AdminPage.jsx`, find the actions `<div>` containing the Pencil, KeyRound, and Trash2 buttons. Add the `MailCheck` button after the `KeyRound` button and before the `Trash2` button:

```jsx
                      <Button
                        size="icon" variant="ghost"
                        disabled={u.emailVerified}
                        onClick={() => handleVerify(u)}
                        title="Vérifier l'email"
                      >
                        <MailCheck className="h-4 w-4" />
                      </Button>
```

- [ ] **Step 7: Commit**

```bash
git add client/src/api/admin.js client/src/pages/AdminPage.jsx
git commit -m "feat: add verify email button and status badge in admin user list"
```

---

## Task 4 — Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd server && yarn test 2>&1 | tail -15
```

Expected: all test files pass (49 tests across 5 files).

- [ ] **Step 2: Manual smoke test**

Start the dev server: `yarn dev` from the repo root.

1. Connectez-vous avec un compte admin
2. Allez sur `/admin` (ou la route admin)
3. Vérifiez que chaque ligne affiche une icône verte (vérifié) ou amber (non vérifié)
4. Pour un utilisateur non vérifié : cliquez le bouton `MailCheck`
5. Vérifiez : icône passe au vert, bouton devient disabled, toast "Email de X vérifié."
6. Pour un utilisateur déjà vérifié : bouton `MailCheck` est disabled

- [ ] **Step 3: Commit final si tout est OK**

Aucun fichier ne devrait rester non commité à ce stade. Vérifiez :

```bash
git status
```

Expected: `nothing to commit, working tree clean`

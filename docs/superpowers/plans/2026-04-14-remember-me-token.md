# Remember Me — Token persistant

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le changement de maxAge de session par un cookie persistant `remember_me` séparé, stocké en base, qui permet de recréer une session après fermeture du navigateur.

**Architecture:** Le login génère un token UUID stocké dans `password_reset_tokens` avec `type='remember_me'`, le pose en cookie persistant `HttpOnly`. Un middleware `remember.js` recrée la session à partir de ce cookie quand aucune session n'est active. Le logout invalide le token et efface le cookie. Le cookie de session (`connect.sid`) redevient une session cookie (sans `maxAge`).

**Tech Stack:** Express 5 / express-session / Passport / better-sqlite3 (dev) / mongoose (prod). Tests : supertest + Jest.

---

## Fichiers

| Fichier | Action | Rôle |
|---|---|---|
| `server/app.js` | Modifier | Retirer `maxAge` du cookie de session + insérer le middleware `remember` |
| `server/routes/auth.js` | Modifier | Login : créer token + cookie. Logout : invalider token + effacer cookie |
| `server/middleware/remember.js` | Créer | Auto-login depuis le cookie `remember_me` |
| `server/tests/auth.test.js` | Modifier | Remplacer les 5 anciens tests session/maxAge par les nouveaux tests remember_me |

---

## Task 1 : Revert de l'ancienne implémentation

**Files:**
- Modify: `server/app.js` (ligne 58)
- Modify: `server/routes/auth.js` (lignes 30, 82–108)
- Modify: `server/tests/auth.test.js` (lignes 58–116)

- [ ] **Step 1 : Supprimer `maxAge` du cookie de session dans `server/app.js`**

Remplacer le bloc `cookie:` de la config session (lignes 56–61) par :

```js
    cookie: {
      httpOnly: true,
      secure: isProd,        // HTTPS uniquement en production
      sameSite: 'strict',    // protection CSRF
      // pas de maxAge → cookie de session (disparaît à la fermeture du navigateur)
    },
```

- [ ] **Step 2 : Supprimer la logique session.maxAge dans `server/routes/auth.js`**

La constante `ALLOWED_DAYS` au niveau module (ligne 30) et tout le bloc à l'intérieur du callback `req.login()` (lignes 85–108) doivent être remplacés par le simple appel d'origine :

```js
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    if (!user.googleId && !user.emailVerified) {
      try {
        const db = req.app.locals.db;
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'email_verify' });
        const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
        await mailer.sendVerificationEmail(user.email, verifyUrl);
      } catch (_) { /* ne pas bloquer la réponse 403 si l'envoi échoue */ }
      return res.status(403).json({ message: 'Email non vérifié. Un lien de vérification vous a été envoyé.' });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(serializeUser(user));
    });
  })(req, res, next);
});
```

Supprimer aussi la constante `const ALLOWED_DAYS = [1, 30, 365];` au niveau module (ligne 30).

- [ ] **Step 3 : Supprimer les 5 anciens tests dans `server/tests/auth.test.js`**

Retirer les 5 tests ajoutés par l'implémentation précédente dans le `describe('POST /api/auth/login', ...)` (lignes 58–116 — les tests `'applique maxAge 1 jour…'`, `'applique maxAge 30 jours…'`, `'applique maxAge 365 jours…'`, `'utilise 30 jours par défaut si rememberDays absent'`, `'utilise 30 jours par défaut si rememberDays invalide'`).

Ne pas toucher aux autres tests existants.

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les tests restants passent (les 2 failures pré-existantes dans `resend-verification` sont hors scope).

- [ ] **Step 5 : Commit**

```bash
git add server/app.js server/routes/auth.js server/tests/auth.test.js
git commit -m "revert: remove session maxAge approach in favour of remember_me token"
```

---

## Task 2 : Login crée le cookie `remember_me`

**Files:**
- Modify: `server/routes/auth.js`
- Modify: `server/tests/auth.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `describe('POST /api/auth/login', ...)` de `server/tests/auth.test.js` :

```js
it('pose un cookie remember_me avec Max-Age 1 jour quand rememberDays=1', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 1 });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] ?? [];
  const rmCookie = cookies.find(c => c.startsWith('remember_me='));
  expect(rmCookie).toBeDefined();
  const maxAgeMatch = rmCookie.match(/Max-Age=(\d+)/i);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch[1])).toBe(1 * 24 * 60 * 60);
});

it('pose un cookie remember_me avec Max-Age 30 jours quand rememberDays=30', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 30 });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] ?? [];
  const rmCookie = cookies.find(c => c.startsWith('remember_me='));
  expect(rmCookie).toBeDefined();
  const maxAgeMatch = rmCookie.match(/Max-Age=(\d+)/i);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch[1])).toBe(30 * 24 * 60 * 60);
});

it('pose un cookie remember_me avec Max-Age 365 jours quand rememberDays=365', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 365 });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] ?? [];
  const rmCookie = cookies.find(c => c.startsWith('remember_me='));
  expect(rmCookie).toBeDefined();
  const maxAgeMatch = rmCookie.match(/Max-Age=(\d+)/i);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch[1])).toBe(365 * 24 * 60 * 60);
});

it('pose un cookie remember_me 30 jours par défaut si rememberDays absent', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app).post('/api/auth/login').send(ALICE);
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] ?? [];
  const rmCookie = cookies.find(c => c.startsWith('remember_me='));
  expect(rmCookie).toBeDefined();
  const maxAgeMatch = rmCookie.match(/Max-Age=(\d+)/i);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch[1])).toBe(30 * 24 * 60 * 60);
});

it('pose un cookie remember_me 30 jours par défaut si rememberDays invalide', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app).post('/api/auth/login').send({ ...ALICE, rememberDays: 999 });
  expect(res.status).toBe(200);
  const cookies = res.headers['set-cookie'] ?? [];
  const rmCookie = cookies.find(c => c.startsWith('remember_me='));
  expect(rmCookie).toBeDefined();
  const maxAgeMatch = rmCookie.match(/Max-Age=(\d+)/i);
  expect(maxAgeMatch).not.toBeNull();
  expect(Number(maxAgeMatch[1])).toBe(30 * 24 * 60 * 60);
});
```

- [ ] **Step 2 : Vérifier que les 5 tests échouent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les 5 nouveaux tests échouent (pas de cookie `remember_me` posé).

- [ ] **Step 3 : Implémenter dans `server/routes/auth.js`**

Ajouter au niveau module (après les imports existants, vers la ligne 30) :

```js
const ALLOWED_DAYS = [1, 30, 365];
const parseCookies = require('cookie').parse;
```

Remplacer le handler `POST /login` (le callback `req.login`) par :

```js
router.post('/login', authLimiter, (req, res, next) => {
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ message: info?.message || 'Échec de connexion' });
    if (!user.googleId && !user.emailVerified) {
      try {
        const db = req.app.locals.db;
        const token = randomUUID();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'email_verify' });
        const verifyUrl = `${SERVER_URL}/api/auth/verify-email/${token}`;
        await mailer.sendVerificationEmail(user.email, verifyUrl);
      } catch (_) { /* ne pas bloquer la réponse 403 si l'envoi échoue */ }
      return res.status(403).json({ message: 'Email non vérifié. Un lien de vérification vous a été envoyé.' });
    }
    const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
      ? Number(req.body.rememberDays)
      : 30;
    req.login(user, async (err) => {
      if (err) return next(err);
      try {
        const db = req.app.locals.db;
        const rememberToken = randomUUID();
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await db.resetTokens.create(user._id ?? user.id, rememberToken, expiresAt, { type: 'remember_me' });
        res.cookie('remember_me', rememberToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: days * 24 * 60 * 60 * 1000,
        });
      } catch (_) { /* ne pas bloquer la connexion si la création du token échoue */ }
      res.json(serializeUser(user));
    });
  })(req, res, next);
});
```

Note : `parseCookies` est importé ici mais utilisé dans la Task 4 (logout). L'import peut être ajouté maintenant ou en Task 4 — les deux fonctionnent.

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les 5 nouveaux tests passent.

- [ ] **Step 5 : Commit**

```bash
git add server/routes/auth.js server/tests/auth.test.js
git commit -m "feat: créer token remember_me en base et poser le cookie persistant au login"
```

---

## Task 3 : Middleware auto-login depuis `remember_me`

**Files:**
- Create: `server/middleware/remember.js`
- Modify: `server/app.js`
- Modify: `server/tests/auth.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter un nouveau `describe` dans `server/tests/auth.test.js` après le `describe('GET /api/auth/me', ...)` existant :

```js
describe('middleware remember_me — auto-login', () => {
  function extractRememberToken(res) {
    const cookies = res.headers['set-cookie'] ?? [];
    const c = cookies.find(s => s.startsWith('remember_me='));
    if (!c) return null;
    return c.split(';')[0].split('=')[1];
  }

  it('GET /api/auth/me retourne 200 avec un cookie remember_me valide (pas de session)', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const loginRes = await request(app).post('/api/auth/login').send(ALICE);
    const token = extractRememberToken(loginRes);
    expect(token).not.toBeNull();

    // Nouvelle requête sans session (request(app) ne partage pas de cookies)
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `remember_me=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(ALICE.email);
  });

  it('GET /api/auth/me retourne 401 avec un cookie remember_me invalide', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'remember_me=token-bidon');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me retourne 401 sans cookie remember_me ni session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les 3 nouveaux tests échouent (pas encore de middleware).

- [ ] **Step 3 : Créer `server/middleware/remember.js`**

```js
// Middleware remember_me : si aucune session active mais cookie remember_me présent et valide,
// recrée une session Passport à partir du token stocké en base.
// Le token n'est pas consommé (markUsed) : il reste valide jusqu'à expiration ou logout.

const parseCookies = require('cookie').parse;

module.exports = (db) => async (req, res, next) => {
  if (req.isAuthenticated()) return next();
  const token = parseCookies(req.headers.cookie || '').remember_me;
  if (!token) return next();
  try {
    const record = await db.resetTokens.findValid(token);
    if (!record || record.type !== 'remember_me') return next();
    const user = await db.users.findById(record.userId);
    if (!user) return next();
    req.login(user, (err) => next(err ?? undefined));
  } catch (_) {
    next();
  }
};
```

- [ ] **Step 4 : Câbler le middleware dans `server/app.js`**

Ajouter après `app.use(passport.session());` (ligne 65) :

```js
  app.use(require('./middleware/remember')(db));
```

Le bloc complet après modification :

```js
  app.use(passport.initialize());
  app.use(passport.session()); // restaure req.user depuis la session à chaque requête
  app.use(require('./middleware/remember')(db));
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les 3 nouveaux tests passent.

- [ ] **Step 6 : Commit**

```bash
git add server/middleware/remember.js server/app.js server/tests/auth.test.js
git commit -m "feat: middleware auto-login depuis le cookie remember_me"
```

---

## Task 4 : Logout invalide le token et efface le cookie

**Files:**
- Modify: `server/routes/auth.js`
- Modify: `server/tests/auth.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans le `describe('POST /api/auth/logout', ...)` existant de `server/tests/auth.test.js` :

```js
  it('efface le cookie remember_me au logout', async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    const logoutRes = await agent.post('/api/auth/logout');
    const cookies = logoutRes.headers['set-cookie'] ?? [];
    const rmCookie = cookies.find(c => c.startsWith('remember_me='));
    expect(rmCookie).toBeDefined();
    // Max-Age=0 ou Expires dans le passé signifie effacement
    expect(rmCookie).toMatch(/Max-Age=0/i);
  });

  it("l'auto-login ne fonctionne plus après logout (token invalidé)", async () => {
    await createVerifiedUser(app, ALICE.email, ALICE.password);
    // Login et récupération du token
    const loginRes = await request(app).post('/api/auth/login').send(ALICE);
    const cookies = loginRes.headers['set-cookie'] ?? [];
    const rmCookie = cookies.find(c => c.startsWith('remember_me='));
    const token = rmCookie.split(';')[0].split('=')[1];

    // Logout avec une session séparée (agent)
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send(ALICE);
    await agent.post('/api/auth/logout').set('Cookie', `remember_me=${token}`);

    // Auto-login avec le token révoqué → doit échouer
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `remember_me=${token}`);
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : les 2 nouveaux tests échouent.

- [ ] **Step 3 : Mettre à jour le handler logout dans `server/routes/auth.js`**

Remplacer l'actuel handler logout :

```js
// POST /api/auth/logout
// req.logout() (Passport) détruit la session côté serveur.
router.post('/logout', wrap(async (req, res) => {
  const token = parseCookies(req.headers.cookie || '').remember_me;
  if (token) {
    try { await req.app.locals.db.resetTokens.markUsed(token); } catch (_) {}
  }
  res.clearCookie('remember_me');
  req.logout(() => res.json({ message: 'Déconnecté' }));
}));
```

Note : `parseCookies` est déjà importé au niveau module (ajouté en Task 2). `wrap` est déjà importé en haut du fichier.

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd /data/git/github.com/accounts-claude/server && yarn test tests/auth.test.js 2>&1 | tail -10
```

Résultat attendu : tous les tests du fichier passent (hors 2 failures pré-existantes dans `resend-verification`).

- [ ] **Step 5 : Commit**

```bash
git add server/routes/auth.js server/tests/auth.test.js
git commit -m "feat: invalider le token remember_me et effacer le cookie au logout"
```

---

## Vérification finale

- [ ] Lancer toute la suite serveur :

```bash
cd /data/git/github.com/accounts-claude/server && yarn test 2>&1 | tail -10
```

- [ ] Vérifier manuellement dans le navigateur :
  1. `http://localhost:5173/login` → Se connecter avec "1 an"
  2. DevTools → Application → Cookies → vérifier que `remember_me` a une date d'expiration ~1 an et que `connect.sid` n'a pas de date d'expiration (session cookie)
  3. Fermer et rouvrir le navigateur → `http://localhost:5173` → vérifier connexion automatique
  4. Se déconnecter → vérifier que `remember_me` est effacé

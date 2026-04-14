# Remember Me — Durée de session configurable

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de choisir la durée de sa session (1 jour, 1 mois, 1 an) au moment de la connexion email/mot de passe.

**Architecture:** Le formulaire de connexion envoie `rememberDays` dans le body du POST login. Le serveur valide la valeur contre une whitelist, puis applique `req.session.cookie.maxAge` avant `req.login()`. La durée par défaut est 30 jours si la valeur est absente ou invalide.

**Tech Stack:** Express 5 / express-session (server), React + Tailwind CSS v4 / shadcn/ui (client), supertest + Jest (server tests), Vitest + Testing Library (client tests).

---

## Files modifiés

| Fichier | Rôle |
|---|---|
| `server/routes/auth.js` | Lire `rememberDays` et appliquer `maxAge` avant `req.login()` |
| `server/tests/auth.test.js` | Tests du comportement `maxAge` dans le cookie de session |
| `client/src/pages/LoginPage.jsx` | Ajouter le sélecteur de durée (3 boutons radio visuels) |
| `client/src/tests/LoginPage.test.jsx` | Tester le sélecteur + mettre à jour le test existant |

---

## Task 1 : Serveur — appliquer `rememberDays` dans le login

**Files:**
- Modify: `server/routes/auth.js` (handler `POST /api/auth/login`, lignes 65-86)
- Test: `server/tests/auth.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter à la fin du `describe('POST /api/auth/login', ...)` existant dans `server/tests/auth.test.js` :

```js
it('applique maxAge 1 jour quand rememberDays=1', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ ...ALICE, rememberDays: 1 });
  expect(res.status).toBe(200);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const match = cookie.match(/Max-Age=(\d+)/i);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBe(1 * 24 * 60 * 60); // 86400 secondes
});

it('applique maxAge 30 jours quand rememberDays=30', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ ...ALICE, rememberDays: 30 });
  expect(res.status).toBe(200);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const match = cookie.match(/Max-Age=(\d+)/i);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBe(30 * 24 * 60 * 60); // 2592000 secondes
});

it('applique maxAge 365 jours quand rememberDays=365', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ ...ALICE, rememberDays: 365 });
  expect(res.status).toBe(200);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const match = cookie.match(/Max-Age=(\d+)/i);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBe(365 * 24 * 60 * 60); // 31536000 secondes
});

it('utilise 30 jours par défaut si rememberDays absent', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app)
    .post('/api/auth/login')
    .send(ALICE); // sans rememberDays
  expect(res.status).toBe(200);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const match = cookie.match(/Max-Age=(\d+)/i);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBe(30 * 24 * 60 * 60);
});

it('utilise 30 jours par défaut si rememberDays invalide', async () => {
  await createVerifiedUser(app, ALICE.email, ALICE.password);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ ...ALICE, rememberDays: 999 });
  expect(res.status).toBe(200);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const match = cookie.match(/Max-Age=(\d+)/i);
  expect(match).not.toBeNull();
  expect(Number(match[1])).toBe(30 * 24 * 60 * 60);
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd server && yarn test tests/auth.test.js 2>&1 | tail -20
```

Résultat attendu : les 5 nouveaux tests échouent (le `Max-Age` actuel est 7 jours = 604800 s, pas les valeurs attendues).

- [ ] **Step 3 : Implémenter dans `server/routes/auth.js`**

Dans le handler `POST /api/auth/login`, remplacer le bloc `req.login(user, ...)` (actuellement ligne ~81) par :

```js
const ALLOWED_DAYS = [1, 30, 365];
const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
  ? Number(req.body.rememberDays)
  : 30;
req.session.cookie.maxAge = days * 24 * 60 * 60 * 1000;
req.login(user, (err) => {
  if (err) return next(err);
  res.json(serializeUser(user));
});
```

Le handler complet après modification :

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
    const ALLOWED_DAYS = [1, 30, 365];
    const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
      ? Number(req.body.rememberDays)
      : 30;
    req.session.cookie.maxAge = days * 24 * 60 * 60 * 1000;
    req.login(user, (err) => {
      if (err) return next(err);
      res.json(serializeUser(user));
    });
  })(req, res, next);
});
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd server && yarn test tests/auth.test.js 2>&1 | tail -20
```

Résultat attendu : tous les tests du fichier passent (y compris les tests existants).

- [ ] **Step 5 : Commit**

```bash
git add server/routes/auth.js server/tests/auth.test.js
git commit -m "feat: appliquer rememberDays au maxAge du cookie de session"
```

---

## Task 2 : Client — sélecteur de durée dans LoginPage

**Files:**
- Modify: `client/src/pages/LoginPage.jsx`
- Test: `client/src/tests/LoginPage.test.jsx`

- [ ] **Step 1 : Mettre à jour le test existant et ajouter les nouveaux tests**

Dans `client/src/tests/LoginPage.test.jsx`, modifier le test `'soumet le formulaire de connexion avec email'` pour attendre `rememberDays: 30` :

```js
it('soumet le formulaire de connexion avec email', async () => {
  mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
  render(<LoginPage />, { wrapper: Wrapper });

  await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'alice@test.com',
      password: 'pass1234',
      rememberDays: 30,
    })
  );
});
```

Ajouter après les tests existants :

```js
it('affiche le sélecteur de durée uniquement sur l\'onglet connexion', () => {
  render(<LoginPage />, { wrapper: Wrapper });
  expect(screen.getByRole('button', { name: '1 jour' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1 mois' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1 an' })).toBeInTheDocument();
});

it('n\'affiche pas le sélecteur de durée sur l\'onglet inscription', async () => {
  render(<LoginPage />, { wrapper: Wrapper });
  await userEvent.click(screen.getByText('Inscription'));
  expect(screen.queryByRole('button', { name: '1 jour' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '1 mois' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '1 an' })).not.toBeInTheDocument();
});

it('envoie rememberDays=1 quand "1 jour" est sélectionné', async () => {
  mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
  render(<LoginPage />, { wrapper: Wrapper });

  await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
  await userEvent.click(screen.getByRole('button', { name: '1 jour' }));
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'alice@test.com',
      password: 'pass1234',
      rememberDays: 1,
    })
  );
});

it('envoie rememberDays=365 quand "1 an" est sélectionné', async () => {
  mockLogin.mockResolvedValue({ _id: '1', email: 'alice@test.com' });
  render(<LoginPage />, { wrapper: Wrapper });

  await userEvent.type(screen.getByLabelText('Adresse email'), 'alice@test.com');
  await userEvent.type(screen.getByLabelText('Mot de passe'), 'pass1234');
  await userEvent.click(screen.getByRole('button', { name: '1 an' }));
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

  await waitFor(() =>
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'alice@test.com',
      password: 'pass1234',
      rememberDays: 365,
    })
  );
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
cd client && yarn test src/tests/LoginPage.test.jsx 2>&1 | tail -20
```

Résultat attendu : le test existant modifié et les 4 nouveaux tests échouent.

- [ ] **Step 3 : Implémenter dans `client/src/pages/LoginPage.jsx`**

Ajouter `rememberDays` au state initial (ligne ~16, dans le `useState`) :

```js
const [rememberDays, setRememberDays] = useState(30);
```

Modifier `handleSubmit` pour inclure `rememberDays` dans l'appel `login` (actuellement ligne ~40) :

```js
if (tab === 'login') {
  await login({ ...form, rememberDays });
} else {
  await register(form);
  setRegistered(true);
}
```

Ajouter le sélecteur de durée dans le JSX, juste après le champ mot de passe et avant le bouton submit, uniquement dans l'onglet login (`tab === 'login'`). Le bloc complet du formulaire après modification :

```jsx
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
  {tab === 'login' && (
    <div className="space-y-1.5">
      <Label>Rester connecté</Label>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {[
          { label: '1 jour', value: 1 },
          { label: '1 mois', value: 30 },
          { label: '1 an', value: 365 },
        ].map(({ label, value }) => (
          <button
            type="button"
            key={value}
            onClick={() => setRememberDays(value)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-semibold transition-all',
              rememberDays === value
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )}
  <Button
    type="submit"
    className="mt-2 h-11 w-full text-base shadow-md shadow-indigo-500/30"
    disabled={loading}
  >
    {loading ? 'Chargement…' : tab === 'login' ? 'Se connecter' : "S'inscrire"}
  </Button>
</form>
```

Note : réinitialiser `rememberDays` à `30` lors du changement d'onglet. Dans l'handler `onClick` des onglets (ligne ~171), ajouter `setRememberDays(30)` :

```js
onClick={() => {
  setTab(key);
  setForm({ email: '', password: '' });
  setUnverifiedEmail(null);
  setRememberDays(30);
}}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
cd client && yarn test src/tests/LoginPage.test.jsx 2>&1 | tail -20
```

Résultat attendu : tous les tests du fichier passent.

- [ ] **Step 5 : Commit**

```bash
git add client/src/pages/LoginPage.jsx client/src/tests/LoginPage.test.jsx
git commit -m "feat: ajouter le sélecteur de durée de session au formulaire de connexion"
```

---

## Vérification finale

- [ ] Lancer la suite complète des tests serveur :

```bash
cd server && yarn test 2>&1 | tail -10
```

- [ ] Lancer la suite complète des tests client :

```bash
cd client && yarn test 2>&1 | tail -10
```

- [ ] Vérifier manuellement dans le navigateur :
  1. Ouvrir `http://localhost:5173/login`
  2. Vérifier que le sélecteur "Rester connecté" apparaît sous le mot de passe
  3. Vérifier que "1 mois" est sélectionné par défaut
  4. Se connecter avec "1 jour" → ouvrir DevTools → Application → Cookies → vérifier que le cookie `connect.sid` expire dans ~1 jour
  5. Se connecter avec "1 an" → vérifier que le cookie expire dans ~1 an
  6. Basculer sur l'onglet "Inscription" → vérifier que le sélecteur disparaît

# Design : Token "remember me" persistant

**Date :** 2026-04-14
**Statut :** Approuvé
**Remplace :** `2026-04-14-remember-me-design.md` (approche session maxAge — revertée)

## Contexte

L'implémentation précédente changeait uniquement le `maxAge` du cookie de session, ce qui ne survit pas à une fermeture de navigateur si la session expire. L'objectif est un **cookie persistant séparé** (`remember_me`) qui permet de recréer une session automatiquement après expiration ou fermeture du navigateur.

## Architecture

Trois composants :

1. **Login** — génère un token, le persiste en base, pose le cookie `remember_me`
2. **Middleware `remember.js`** — recrée une session à partir du token si aucune session active
3. **Logout** — invalide le token en base et efface le cookie

### Cookie de session (`connect.sid`)

Redevient un vrai cookie de session : `maxAge` retiré de la config dans `app.js`. Il disparaît à la fermeture du navigateur. Le cookie `remember_me` lui survit.

### Cookie `remember_me`

Cookie persistant séparé, HttpOnly, Secure (prod), SameSite=Strict. Durée selon le choix de l'utilisateur.

### Store de tokens

Réutilise le store `resetTokens` existant avec `type: 'remember_me'`. Pas de migration ni de nouvelle table. `findValid` vérifie `used: false && expiresAt > now` — comportement correct. Le token n'est **pas** consommé (`markUsed`) à chaque auto-login : il reste valide jusqu'à expiration ou logout explicite. Au logout, `markUsed` invalide le token.

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `server/app.js` | Retirer `maxAge` du cookie de session + ajouter le middleware `remember` |
| `server/routes/auth.js` | Remplacer la logique `session.maxAge` par création de token + cookie `remember_me` ; invalider au logout |
| `server/middleware/remember.js` | Nouveau — auto-login depuis le cookie `remember_me` |
| `server/tests/auth.test.js` | Remplacer les tests `rememberDays/maxAge` par des tests sur le cookie `remember_me` et l'auto-login |

Le client (`LoginPage.jsx`, `AuthContext.jsx`, `api/auth.js`) **n'est pas modifié** — il envoie déjà `rememberDays` dans le body du login.

## Détail des changements

### `server/app.js`

Retirer `maxAge` du cookie de session :

```js
cookie: {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  // maxAge retiré → cookie de session (disparaît à la fermeture du navigateur)
}
```

Ajouter le middleware `remember` après `passport.session()` et avant les routes :

```js
app.use(require('./middleware/remember')(db));
```

### `server/routes/auth.js` — login

Remplacer la logique `ALLOWED_DAYS / session.cookie.maxAge` par :

```js
const ALLOWED_DAYS = [1, 30, 365];
const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
  ? Number(req.body.rememberDays)
  : 30;
req.login(user, async (err) => {
  if (err) return next(err);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db.resetTokens.create(user._id ?? user.id, token, expiresAt, { type: 'remember_me' });
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('remember_me', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: days * 24 * 60 * 60 * 1000,
  });
  res.json(serializeUser(user));
});
```

`ALLOWED_DAYS` est déclaré au niveau module (déjà fait dans l'implémentation précédente).

### `server/routes/auth.js` — logout

```js
router.post('/logout', wrap(async (req, res) => {
  const token = require('cookie').parse(req.headers.cookie || '').remember_me;
  if (token) {
    try { await db.resetTokens.markUsed(token); } catch (_) {}
  }
  res.clearCookie('remember_me');
  req.logout(() => res.json({ message: 'Déconnecté' }));
}));
```

### `server/middleware/remember.js` (nouveau)

```js
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

## Sécurité

- Token généré avec `randomUUID()` (CSPRNG natif Node.js)
- Cookie `HttpOnly` → inaccessible au JS
- Cookie `SameSite=Strict` → protection CSRF
- Token invalidé au logout → pas de session zombie
- Le middleware ne plante jamais la requête : toute erreur appelle `next()` sans authentifier

## Ce qui ne change pas

- UI client (LoginPage.jsx) — inchangé
- AuthContext, api/auth.js — inchangés
- Google OAuth — non concerné
- Routes protégées — inchangées
- Mobile React Native — hors scope

# Design : Durée de session configurable au login

**Date :** 2026-04-14
**Statut :** Approuvé

## Contexte

La session actuelle a une durée fixe de 7 jours (`maxAge` dans `app.js`). L'utilisateur veut choisir combien de temps il reste connecté parmi 3 durées prédéfinies, stockées via le cookie de session existant.

La fonctionnalité s'applique uniquement au formulaire email/mot de passe. La connexion Google OAuth n'est pas concernée.

## Approche retenue

**`maxAge` dynamique dans la session** — le client envoie `rememberDays` dans le body du login, le serveur ajuste `req.session.cookie.maxAge` avant `req.login()`. Zéro dépendance ajoutée.

## Serveur — `server/routes/auth.js`

Dans le handler `POST /api/auth/login`, après authentification Passport et avant `req.login()` :

```js
const ALLOWED_DAYS = [1, 30, 365];
const days = ALLOWED_DAYS.includes(Number(req.body.rememberDays))
  ? Number(req.body.rememberDays)
  : 30;
req.session.cookie.maxAge = days * 24 * 60 * 60 * 1000;
```

- Whitelist stricte : seules les valeurs `1`, `30`, `365` sont acceptées.
- Valeur par défaut si absent ou invalide : `30` jours.
- La config globale `maxAge: 7 jours` dans `app.js` reste inchangée (sert de fallback pour Google OAuth et autres cas).

## Client — `client/src/pages/LoginPage.jsx`

- Ajout d'un state local `rememberDays` initialisé à `30`.
- Sous le champ mot de passe, dans l'onglet "Connexion" uniquement : 3 boutons radio visuels (style segmenté, cohérent avec le design existant) — **1 jour**, **1 mois** (défaut), **1 an**.
- `rememberDays` est inclus dans l'objet passé à `login(form)`.

## Client — `client/src/store/AuthContext.jsx` et `client/src/api/auth.js`

- La fonction `login()` dans `AuthContext` transmet le body tel quel à l'API.
- La fonction `login` dans `api/auth.js` doit inclure `rememberDays` dans le body du `POST /api/auth/login`.

## Ce qui ne change pas

- `app.js` : la config de session globale reste inchangée.
- Google OAuth : aucune modification.
- Inscription : aucune modification.
- Mobile (React Native) : hors scope.

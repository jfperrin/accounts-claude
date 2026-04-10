# Design — Vérification d'email (inscription et changement)

**Date :** 2026-04-10  
**Statut :** Approuvé

---

## Contexte

L'application gère des comptes financiers personnels. L'authentification est email-based (local ou Google OAuth). Actuellement :
- L'inscription crée le compte et ouvre la session immédiatement, sans vérifier l'email.
- Le changement d'email (page Profil) est appliqué instantanément sans confirmation.

Ce design ajoute une procédure de vérification par lien magique pour ces deux cas.

---

## Périmètre

- **Inclus :** inscription locale, changement d'email depuis le profil, renvoi du mail de vérification.
- **Exclus :** comptes Google OAuth (Google garantit l'email), application mobile (hors scope).

---

## Expéditeur

Tous les emails sont envoyés avec `jf@perrin.at` comme expéditeur (valeur fixe dans `utils/mailer.js`, suppression de `RESEND_FROM`).

---

## Modèle de données

### `PasswordResetToken` → étendu

Deux champs optionnels ajoutés au schéma existant :

| Champ | Type | Description |
|-------|------|-------------|
| `type` | String | `'password_reset'` \| `'email_verify'` \| `'email_change'` |
| `pendingEmail` | String? | Uniquement pour `type='email_change'` : le nouvel email à valider |

**Expiration :**
- `password_reset` : 1h (inchangé)
- `email_verify` : 24h
- `email_change` : 24h

**Migration SQLite :** deux `ALTER TABLE password_reset_tokens ADD COLUMN` idempotents dans `initSchema`.  
**MongoDB :** champs optionnels dans le schéma Mongoose, aucune migration nécessaire.

### `User` — champ ajouté

| Champ | Type | Défaut |
|-------|------|--------|
| `emailVerified` | Boolean | `false` |

Les comptes Google OAuth sont créés avec `emailVerified: true`.

---

## Routes serveur

### Nouvelles routes (`routes/auth.js`)

#### `POST /api/auth/resend-verification`
- Requiert une session active (`requireAuth`).
- Rate-limitée (même limiteur que login/register : 20 req / 15 min par IP).
- Crée un token `email_verify`, envoie l'email, retourne `{ message: 'Email envoyé' }`.
- Si `emailVerified === true` : retourne 400.

#### `GET /api/auth/verify-email/:token`
- Route publique.
- Cherche un token valide (`used=false`, `expiresAt > now`).
- Si `type='email_verify'` : passe `emailVerified=true` sur le User.
- Si `type='email_change'` : applique `pendingEmail` comme nouvel email, passe `emailVerified=true`.
- Invalide le token (`used=true`).
- Redirige vers `CLIENT_URL/?verified=1`.
- Token invalide ou expiré → redirige vers `CLIENT_URL/login?error=token_expired`.

### Modifications existantes

#### `POST /api/auth/register`
- Après création du User (`emailVerified=false`) :
  - Crée un token `email_verify` (24h).
  - Envoie l'email de vérification.
  - **Ne démarre pas de session.**
  - Retourne HTTP 201 `{ message: 'Vérifiez votre email' }`.

#### `POST /api/auth/login`
- Si `user.emailVerified === false` (comptes locaux uniquement) :
  - Retourne HTTP 403 `{ message: 'Email non vérifié. Vérifiez votre boîte mail.' }`.
- Les comptes Google (`googleId` présent) ignorent cette vérification.

#### `PUT /api/auth/email`
- Ne modifie plus l'email en base.
- Crée un token `email_change` avec `pendingEmail = nouvelEmail` (24h).
- Envoie l'email au *nouvel* email.
- Retourne `{ message: 'Un lien de confirmation a été envoyé à [email]' }`.

---

## `utils/mailer.js`

- `FROM` fixé à `'jf@perrin.at'` (constante, plus de `RESEND_FROM`).
- Nouvelle fonction `sendVerificationEmail(to, verifyUrl)`.
- Nouvelle fonction `sendEmailChangeEmail(to, verifyUrl)`.

```
verifyUrl = `${CLIENT_URL}/api/auth/verify-email/${token}`
```

En dev sans clé Resend : log de l'URL dans la console (comportement actuel conservé).

---

## Client web

### `LoginPage.jsx`
- Après inscription réussie (HTTP 201) : afficher un écran "Vérifiez votre boîte mail" à la place du formulaire.
- Si le serveur retourne 403 à la connexion (email non vérifié) : toast d'erreur avec message explicite + bouton "Renvoyer l'email".

### `App.jsx` / routing
- Lire le paramètre `?verified=1` sur la page d'accueil ou login pour afficher un toast de succès après validation du lien.

### `ProfilePage.jsx`
- Bouton "Mettre à jour l'email" : affiche un toast "Un lien de confirmation a été envoyé à [email]" (plus de mise à jour immédiate de `user.email`).
- Si `user.emailVerified === false` : bannière d'avertissement en haut de page avec bouton "Renvoyer l'email de vérification".

### `store/AuthContext.jsx` / `serializeUser` (serveur)
- `emailVerified` inclus dans la réponse de `/me`, `/login`, et `/register`.

---

## Flux résumés

### Inscription
```
User remplit formulaire → POST /register
→ Compte créé (emailVerified=false)
→ Email envoyé (token email_verify, 24h)
→ Affichage "Vérifiez votre boîte mail"
→ User clique le lien → GET /verify-email/:token
→ emailVerified=true, redirect vers /?verified=1
→ User peut se connecter
```

### Changement d'email
```
User saisit nouvel email → PUT /auth/email
→ Token email_change créé (pendingEmail = nouvelEmail, 24h)
→ Email envoyé au nouvel email
→ Toast "Lien envoyé"
→ User clique le lien → GET /verify-email/:token
→ email = pendingEmail, emailVerified=true
→ Redirect vers /?verified=1
```

---

## Gestion d'erreurs

| Cas | Comportement |
|-----|-------------|
| Token expiré | Redirect `CLIENT_URL/login?error=token_expired` |
| Token déjà utilisé | Même redirect |
| Email déjà utilisé (changement) | 409, toast côté client |
| Resend non configuré (dev) | Log console, pas d'envoi |
| Compte Google tente login sans emailVerified | N/A — Google crée avec `emailVerified=true` |

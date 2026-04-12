# Changement de mot de passe avec notification email et lien d'annulation

**Date :** 2026-04-12
**Statut :** Approuvé

## Résumé

Permettre aux utilisateurs connectés de changer leur mot de passe depuis la page Profil. Un email de notification est envoyé immédiatement après le changement, contenant un lien d'annulation valide 12 heures qui restaure l'ancien mot de passe.

---

## Flux

```
[ProfilePage] → PUT /api/auth/password
                  ↓ vérifie mot de passe actuel (bcrypt.compare)
                  ↓ hash le nouveau mot de passe
                  ↓ sauvegarde nouveau hash en base
                  ↓ crée token type "password_change_cancel" (12h, stocke oldPasswordHash)
                  ↓ envoie email à l'utilisateur avec lien cancel
                  ↓ 200 OK

[Email] → clic "Annuler le changement"
  → GET /api/auth/cancel-password-change/:token
      ↓ vérifie token valide (non expiré, non utilisé, type correct)
      ↓ restaure oldPasswordHash en base
      ↓ marque token used
      ↓ redirect CLIENT_URL/login?password_cancelled=1

[LoginPage] → affiche bannière "Changement de mot de passe annulé"
```

---

## Serveur

### 1. `server/models/PasswordResetToken.js`

Ajout du champ :
```js
oldPasswordHash: { type: String }  // stocké uniquement pour password_change_cancel
```

Ajout du type dans l'enum :
```js
type: { type: String, enum: ['password_reset', 'email_verify', 'email_change', 'password_change_cancel'], ... }
```

### 2. `server/db/mongo.js`

`resetTokens.create` accepte déjà des options arbitraires via le 4e paramètre. Ajouter `oldPasswordHash` dans la déstructuration et le passage à `PasswordResetToken.create`.

### 3. `server/db/sqlite.js`

- Migration : ajouter colonne `old_password_hash TEXT` à la table des reset tokens (idempotent via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ou try/catch).
- `resetTokens.create` : accepter et persister `oldPasswordHash`.
- `resetTokens.findValid` : inclure `old_password_hash` dans le SELECT.

### 4. `server/routes/auth.js` — 2 nouvelles routes

**`PUT /api/auth/password`** (requireAuth, authLimiter)
- Body : `{ currentPassword, newPassword }`
- Validation : `newPassword.length >= 8`
- Cas Google OAuth : si `user.passwordHash` est null → 400 "Compte Google, changement de mot de passe non disponible"
- `bcrypt.compare(currentPassword, userWithHash.passwordHash)` → 401 si incorrect
- `bcrypt.hash(newPassword, 12)`
- `db.users.setPassword(userId, newHash)`
- Crée token `password_change_cancel`, `expiresAt = now + 12h`, `oldPasswordHash = ancien hash`
- `mailer.sendPasswordChangeEmail(user.email, cancelUrl)`
- Réponse : `200 { message: "Mot de passe mis à jour" }`

**`GET /api/auth/cancel-password-change/:token`**
- `db.resetTokens.findValid(token)` → redirect `/login?error=token_expired` si invalide
- Vérifie `record.type === 'password_change_cancel'`
- `db.users.setPassword(record.userId, record.oldPasswordHash)`
- `db.resetTokens.markUsed(token)`
- Redirect `CLIENT_URL/login?password_cancelled=1`

### 5. `server/utils/mailer.js` — nouvelle fonction

**`sendPasswordChangeEmail(to, cancelUrl)`**
- Sujet : "Votre mot de passe a été modifié — Comptes"
- Corps : notification du changement + bouton "Annuler le changement" (style indigo existant) + mention "lien valide 12 heures" + "Si vous êtes à l'origine de ce changement, ignorez cet email."

---

## Client

### 1. `client/src/api/profile.js`

```js
export const changePassword = (currentPassword, newPassword) =>
  client.put('/auth/password', { currentPassword, newPassword });
```

### 2. `client/src/pages/ProfilePage.jsx`

Nouvelle section "Mot de passe" insérée entre la section Email et la section Profil :
- 3 champs : mot de passe actuel, nouveau mot de passe, confirmer le nouveau mot de passe
- Validation côté client : nouveau === confirmation, longueur >= 8
- Toast succès / erreurs :
  - 401 → "Mot de passe actuel incorrect"
  - 400 → message serveur (Google OAuth, longueur)
  - Succès → "Mot de passe mis à jour. Un email de confirmation vous a été envoyé."
- Après succès : vider les 3 champs

### 3. `client/src/pages/LoginPage.jsx`

Lire `?password_cancelled=1` dans l'URL et afficher une bannière (style vert/succès) : "Votre changement de mot de passe a été annulé."

---

## Edge cases & sécurité

| Cas | Comportement |
|-----|-------------|
| Compte Google sans mot de passe local | 400 "Compte Google, changement de mot de passe non disponible" |
| Mot de passe actuel incorrect | 401 "Mot de passe actuel incorrect" |
| Nouveau mot de passe < 8 caractères | 400 (validé client + serveur) |
| Token expiré ou déjà utilisé | Redirect `/login?error=token_expired` |
| Rate limiting | `authLimiter` existant (20 req / 15 min / IP) |
| Sessions autres appareils | Restent valides (hors scope) |

---

## Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `server/models/PasswordResetToken.js` | Ajout champ + enum |
| `server/db/mongo.js` | Accepter `oldPasswordHash` dans `resetTokens.create` |
| `server/db/sqlite.js` | Migration colonne + persistance `oldPasswordHash` |
| `server/routes/auth.js` | 2 nouvelles routes |
| `server/utils/mailer.js` | `sendPasswordChangeEmail` |
| `client/src/api/profile.js` | `changePassword` |
| `client/src/pages/ProfilePage.jsx` | Section mot de passe |
| `client/src/pages/LoginPage.jsx` | Bannière `password_cancelled` |

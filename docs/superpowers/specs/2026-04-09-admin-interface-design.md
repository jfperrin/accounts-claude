# Design — Interface Administration

**Date :** 2026-04-09
**Statut :** Approuvé

---

## Contexte

L'application "Comptes" est une gestion de budget personnel multi-utilisateurs. Il n'existe actuellement aucun rôle : tous les comptes sont équivalents. Ce spec ajoute un rôle admin et une interface de gestion des utilisateurs accessible uniquement aux admins.

---

## Décisions de design

| Sujet | Décision |
|---|---|
| Granularité des rôles | Enum `role: String` — valeurs `"user"` \| `"admin"`, défaut `"user"` |
| Création du compte admin | Boot-time via variables d'env `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` (idempotent) |
| Localisation de l'interface | Dans l'appli existante, route `/admin` conditionnelle au rôle |
| Email obligatoire | Oui — requis à la création d'un utilisateur par l'admin |
| Provider email | Resend (SDK Node.js, 3 000 emails/mois gratuits, clé `RESEND_API_KEY`) |
| Reset mot de passe | Lien par email avec token UUID à durée limitée (1h) |

---

## 1. Modèle de données

### Champs ajoutés à `User`

```
role: String       — enum ["user", "admin"], défaut "user"
email: String      — non requis au niveau Mongoose (compatibilité comptes existants)
                     mais obligatoire lors de la création via l'interface admin
```

Les deux backends (MongoDB + SQLite) doivent être mis à jour :
- **Mongoose** : ajout des champs dans `server/models/User.js`
- **SQLite** : migration `ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'` et `ADD COLUMN email TEXT` dans `server/db/sqlite.js` (idempotent, try/catch par colonne)

### Nouveau modèle `PasswordResetToken`

| Champ | Type | Description |
|---|---|---|
| `token` | String, unique | UUID v4 généré côté serveur |
| `userId` | Ref User | Propriétaire du token |
| `expiresAt` | Date | Maintenant + 1 heure |
| `used` | Boolean, défaut false | Invalidé après usage |

**MongoDB :** nouveau fichier `server/models/PasswordResetToken.js`
**SQLite :** nouvelle table `password_reset_tokens` dans le schéma SQLite

---

## 2. Serveur

### 2.1 Seed admin au boot

**Fichier :** `server/utils/ensureAdmin.js`

- Appelé dans `server/index.js` après l'initialisation de la DB
- Lit `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` depuis `process.env`
- Si aucune des trois variables n'est définie : no-op (silencieux)
- Si le compte n'existe pas : le crée avec `role: "admin"`
- Si le compte existe avec `role: "user"` : met à jour le role en `"admin"` (idempotent)
- Log minimal : `[admin] Compte admin "username" prêt.`

Variables à ajouter dans `server/.env` (et `.env.example`) :
```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
ADMIN_EMAIL=admin@example.com
```

### 2.2 Middleware `requireAdmin`

**Fichier :** `server/middleware/requireAdmin.js`

- Vérifie `req.isAuthenticated()` ET `req.user?.role === 'admin'`
- Retourne `403 { message: 'Accès refusé' }` sinon
- Toujours utilisé en complément de `requireAuth` (pas en remplacement)

### 2.3 Routes admin

**Fichier :** `server/routes/admin.js` — préfixe `/api/admin`
Toutes les routes sont protégées par `requireAuth` + `requireAdmin`.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/users` | Liste tous les users (sans passwordHash) |
| `POST` | `/users` | Crée un user — body : `{ username, email, password, role }` |
| `PUT` | `/users/:id` | Modifie `username`, `email`, `role` |
| `DELETE` | `/users/:id` | Supprime user + toutes ses données en cascade |
| `POST` | `/users/:id/reset-password` | Génère un token et envoie l'email de reset |

**Suppression en cascade** (`DELETE /users/:id`) : supprime dans l'ordre — opérations, périodes, opérations récurrentes, banques, tokens de reset, puis le user.

**Garde admin** : un admin ne peut pas supprimer ni rétrograder son propre compte.

### 2.4 Repositories — nouvelles méthodes

À ajouter dans `server/db/mongo.js` et `server/db/sqlite.js` :

```
users.findAll()                        — liste tous les users sans passwordHash
users.updateByAdmin(id, data)          — met à jour username, email, role
users.deleteUser(id)                   — supprime le user
resetTokens.create(userId, token, expiresAt)
resetTokens.findValid(token)           — token non expiré et non utilisé
resetTokens.markUsed(token)
resetTokens.deleteByUser(userId)       — nettoyage lors de la suppression du user
```

### 2.5 Routes reset password (publiques)

Ajoutées dans `server/routes/auth.js` :

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/reset-password/:token` | Vérifie la validité du token — `200` ou `400/410` |
| `POST` | `/reset-password/:token` | Body : `{ password }` — hash, sauvegarde, invalide le token |

### 2.6 Mailer

**Fichier :** `server/utils/mailer.js`

- Utilise le SDK `resend` (`npm install resend`)
- Variable `RESEND_API_KEY` dans l'env
- Expéditeur par défaut : `onboarding@resend.dev` (domaine Resend gratuit)
- Fonction exposée : `sendPasswordResetEmail(to, resetUrl)`
- Template HTML minimal en français

### 2.7 `serializeUser` — ajout du rôle

La fonction `serializeUser` dans `server/routes/auth.js` inclut désormais `role` dans la réponse JSON. Impacte `/register`, `/login`, `/me`, `/profile`.

---

## 3. Client

### 3.1 `AuthContext`

- `user.role` est désormais disponible dans le contexte
- Ajout d'un helper `isAdmin` : `user?.role === 'admin'`

### 3.2 Navigation conditionnelle (`AppShell`)

Si `user.role === 'admin'` :
- **Sidebar desktop** : item "Administration" avec icône `ShieldCheck` (lucide-react), route `/admin`, inséré en dernier dans `NAV_ITEMS`
- **Bottom tabs mobile** : onglet "Admin" avec icône `ShieldCheck`, inséré en dernier dans `BOTTOM_TABS`

### 3.3 Route protégée `/admin`

**Composant :** `client/src/components/RequireAdmin.jsx`
- Si `user.role !== 'admin'` : redirige vers `/`
- Utilisé comme wrapper dans `App.jsx`

**Page :** `client/src/pages/AdminPage.jsx`

Structure :
- Titre "Administration — Utilisateurs"
- Bouton "Nouvel utilisateur" → ouvre `UserFormModal` en mode création
- Tableau des utilisateurs :
  - Colonnes : Username, Email, Rôle, Créé le, Actions
  - Actions par ligne :
    - Bouton "Éditer" → ouvre `UserFormModal` en mode édition
    - Bouton "Réinitialiser le mot de passe" → appel API + toast confirmation (désactivé si pas d'email)
    - Bouton "Supprimer" → dialog de confirmation `AlertDialog` (shadcn/ui)
- Ligne de l'admin courant : actions Supprimer et Rétrograder désactivées

**Modal :** `client/src/components/admin/UserFormModal.jsx`
- Champs : Username, Email (obligatoire), Password (création uniquement), Rôle (Select)
- Validation côté client : champs non vides, email valide, password ≥ 8 caractères (création)

**API :** `client/src/api/admin.js`
```
getUsers()
createUser({ username, email, password, role })
updateUser(id, { username, email, role })
deleteUser(id)
sendPasswordReset(id)
```

### 3.4 Page reset mot de passe (publique)

**Page :** `client/src/pages/ResetPasswordPage.jsx`

- Route `/reset-password` — hors `<PrivateRoute>`, ajoutée dans `App.jsx`
- Lit `?token=xxx` depuis l'URL
- Au montage : `GET /api/auth/reset-password/:token` pour vérifier la validité
  - Token invalide ou expiré → message d'erreur, pas de formulaire
  - Token valide → formulaire "Nouveau mot de passe" + "Confirmer"
- À la soumission : `POST /api/auth/reset-password/:token`
  - Succès → message de confirmation + lien vers `/login`
  - Erreur → toast d'erreur

---

## 4. Variables d'environnement

### Ajouts dans `server/.env`

```
# Admin par défaut (optionnel — si absent, aucun compte admin n'est créé au boot)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
ADMIN_EMAIL=admin@example.com

# Resend (reset mot de passe)
RESEND_API_KEY=<votre_clé>
RESEND_FROM=onboarding@resend.dev   # optionnel, défaut onboarding@resend.dev
```

---

## 5. Ce qui n'est PAS dans ce scope

- Impersonation (se connecter en tant qu'un autre user)
- Historique des actions admin (audit log)
- Blocage/désactivation d'un compte sans suppression
- Reset de mot de passe initié par l'utilisateur lui-même (self-service)
- Interface mobile React Native (admin web uniquement)

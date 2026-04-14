# Email comme identifiant unique — Design

**Date :** 2026-04-10  
**Scope :** Serveur (SQLite + Mongo) + Client web. React Native exclu.

## Contexte

Le champ `username` était l'identifiant de connexion, avec `email` comme champ optionnel en parallèle.
En pratique les deux sont identiques. On supprime `username` et on fait d'`email` le seul identifiant.

---

## 1. Modèle de données

### SQLite (`db/sqlite.js`)
- Colonne `username` supprimée de la table `users`
- Colonne `email` passe `NOT NULL UNIQUE`
- `findByUsername(username)` → `findByEmail(email)`
- `usernameExists(username)` → `emailExists(email)`
- `create({ username, ... })` → `create({ email, ... })`
- `updateByAdmin(id, { username, email, role })` → `updateByAdmin(id, { email, role })`

### Mongoose (`models/User.js`)
- Champ `username` supprimé
- `email` : `{ type: String, required: true, unique: true, trim: true }`
- Index sparse sur `googleId` inchangé

### `db/mongo.js`
- Mêmes renommages que SQLite (`findByEmail`, `emailExists`, etc.)
- `updateByAdmin` ne prend plus `username`

---

## 2. Routes serveur

### `config/passport.js`
- `LocalStrategy` configurée avec `usernameField: 'email'`
- Appelle `db.users.findByEmail(email)`

### `routes/auth.js`
- `POST /register` : paramètres `{ email, password }` — `username` supprimé
  - Vérifie `emailExists(email)` → 409 si doublon
- `serializeUser(u)` : expose `email` à la place de `username`
- `PUT /profile` : inchangé (title, firstName, lastName, nickname)
- Nouveau `PUT /email` : change l'email de l'utilisateur connecté
  - Paramètre : `{ email }`
  - Vérifie le doublon (`emailExists`) → 409 si pris
  - Met à jour via `db.users.updateEmail(id, email)`
  - Retourne le user sérialisé

### `routes/admin.js`
- `POST /users` : paramètres requis `{ email, password, role }` — `username` supprimé
  - Vérifie `emailExists(email)` → 409 si doublon
- `PUT /users/:id` : paramètres `{ email, role }` — `username` supprimé
  - Doublon détecté sur `email` → 409
- `serializeAdminUser` : champ `username` retiré

### `utils/ensureAdmin.js`
- Utilise `ADMIN_EMAIL` + `ADMIN_PASSWORD` (plus de `ADMIN_USERNAME`)
- Recherche l'admin existant via `db.users.findByEmail(ADMIN_EMAIL)`

---

## 3. Nouveau repo method

Les deux backends (SQLite et Mongo) exposent une méthode supplémentaire :

```
users.updateEmail(id, email) → User
```

SQLite : `UPDATE users SET email=?, updated_at=datetime('now') WHERE id=?`  
Mongo : `User.findByIdAndUpdate(id, { $set: { email } }, { new: true }).select('-passwordHash')`

---

## 4. Client web

### `LoginPage.jsx`
- État local `{ email, password }` (plus de `username`)
- Champ : `<Label>Adresse email</Label>` + `<Input type="email" />`
- Payload envoyé au login et à l'inscription : `{ email, password }`

### `ProfilePage.jsx`
- Champ "Adresse email" ajouté au formulaire, pré-rempli depuis `user.email`
- Appelle `PUT /api/auth/email` via nouvelle fonction `updateEmail(email)` dans `api/profile.js`
- Gestion d'erreur 409 → toast "Adresse email déjà utilisée"
- Fallback nom affiché : `nickname || [firstName + ' ' + lastName].trim() || email`
- Placeholder du champ surnom : `user?.email`

### `UserFormModal.jsx` (admin)
- Champ `username` supprimé du formulaire et du payload
- Validation : `email` requis (+ password à la création)
- Payload création : `{ email, password, role }`
- Payload édition : `{ email, role }`

### `AppShell.jsx`
- `displayName` :
  ```js
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
  const displayName = user?.nickname || fullName || user?.email;
  ```

---

## 5. Google OAuth

Le flow Google stocke déjà l'email du profil. Avec la suppression de `username` :
- `db.users.create({ googleId, email })` — plus de génération de username artificiel
- `usernameExists` / conflit de username : supprimés du flow Google

---

## 6. Ce qui ne change pas

- Passport `serializeUser` / `deserializeUser` (basés sur `_id`)
- Routes CRUD banks / operations / periods / recurring
- Reset password (utilise déjà `user.email`)
- AppShell mobile bottom nav et structure de layout
- React Native (hors scope)

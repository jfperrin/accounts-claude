# Validation d'email par l'admin

**Date :** 2026-04-12
**Statut :** Approuvé

## Résumé

Permettre à un administrateur de marquer manuellement l'email d'un utilisateur comme vérifié depuis la page d'administration. L'action est non-destructive et idempotente.

---

## Serveur

### `server/routes/admin.js`

**1. `serializeAdminUser`** — ajouter `emailVerified` :
```js
emailVerified: u.emailVerified ?? false,
```

**2. Nouvelle route `POST /api/admin/users/:id/verify-email`** :
- `db.users.findById(id)` → 404 si absent
- `db.users.setEmailVerified(id)` (méthode existante, idempotente)
- Retourne `serializeAdminUser(updated)` avec 200

Aucun middleware supplémentaire : la route hérite du `requireAuth + requireAdmin` appliqué à tout le préfixe `/api/admin` dans `app.js`.

---

## Client

### `client/src/api/admin.js`

```js
export const verifyEmail = (id) => client.post(`/admin/users/${id}/verify-email`);
```

### `client/src/pages/AdminPage.jsx`

**Colonne "Vérifié"** dans le tableau (entre Email et Rôle) :
- Header : "Vérifié"
- Cellule : icône `<CheckCircle2>` verte si `u.emailVerified`, `<XCircle>` amber sinon
- Classe `hidden md:table-cell` pour cohérence avec l'existant

**Bouton icône `<MailCheck>`** dans les actions (avant Supprimer) :
- `title="Vérifier l'email"`
- `disabled={u.emailVerified}`
- Appelle `handleVerify(u)`

**Handler `handleVerify`** :
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

---

## Edge cases

| Cas | Comportement |
|-----|-------------|
| Email déjà vérifié | Idempotent (setEmailVerified est un UPDATE sans condition) — 200, pas d'erreur |
| Utilisateur inexistant | 404 |
| Compte Google (déjà vérifié) | Bouton disabled côté client (`u.emailVerified === true`) |

---

## Fichiers modifiés

| Fichier | Nature |
|---------|--------|
| `server/routes/admin.js` | `serializeAdminUser` + nouvelle route |
| `client/src/api/admin.js` | `verifyEmail` |
| `client/src/pages/AdminPage.jsx` | Colonne + bouton + handler |

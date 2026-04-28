# reactNative/CLAUDE.md

App Expo (React Native) qui partage le domaine métier avec `server/`. Pour la doc globale et les commandes générales, voir [`../CLAUDE.md`](../CLAUDE.md).

## ⚠ État actuel : non migré

Cette app **n'a pas été mise à jour** vers le modèle de domaine actuel. Elle est cassée en l'état pour les raisons suivantes :

| Manquant | Côté serveur | Impact RN |
|----------|--------------|-----------|
| `Bank.currentBalance` | colonne ajoutée | les écrans Banks et Dashboard ne lisent/écrivent pas ce champ |
| Modèle `Category` + routes `/api/categories` | ajouté | aucun écran de gestion ; `Operation.category` non géré |
| `category_hints` (auto-affectation) | nouvelle table + routes | non utilisé |
| Suppression de `Period` | ops sont une liste plate | RN attend toujours une notion de période |
| Champs profil étendus (`title`, `firstName`, etc.) | ajoutés | écran Profil utilise toujours `username` (qui n'existe plus) |
| Auth email + Google + email-verify + reset-password | flow complet ajouté | RN ne gère que login/register basique |

**Avant de relancer le mobile** : auditer `screens/`, `api/`, `db/repositories/`, et `store/AuthContext.tsx` contre l'état actuel du serveur. La migration vaut son propre cycle de spec → plan → implémentation.

## Architecture (à valider lors de la migration)

App Expo SDK 55, TypeScript, navigation par bottom-tab.

### Dual data source

Le client choisit entre SQLite local et HTTP API au démarrage :

| Condition | Backend |
|-----------|---------|
| `__DEV__` ET `EXPO_PUBLIC_USE_LOCAL_DB !== "false"` | SQLite (expo-sqlite) |
| prod OU `EXPO_PUBLIC_USE_LOCAL_DB=false` | HTTP API |

Variables `EXPO_PUBLIC_*` sont injectées par Expo au build → le drapeau doit être lu une seule fois et propagé via DI plutôt que checké à chaque appel.

### Layer SQLite (`src/db/`)

- `client.ts` — singleton `getDb()`, migrations idempotentes, `generateId()` → `<timestamp_b36><random>` (compatible avec le format `_id` attendu côté UI)
- `db/repositories/` — un fichier par entité, SQL brut, **doit exposer la même interface que les fichiers `api/`**

### Auth (`src/store/AuthContext.tsx`)

Pattern trois-états comme côté web (`undefined` = loading, `null` = anonyme, objet = connecté).

⚠ Le type `User` actuel utilise `username` au lieu de `email` → à mettre à jour.

## Commandes

```bash
cd reactNative
yarn start                # Expo dev server
yarn android              # Android emulator
yarn ios                  # iOS simulator
yarn test                 # jest-expo (single run)
yarn test:watch
```

`reactNative/.env` (gitignored) :

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_USE_LOCAL_DB=
```

## Plan de migration suggéré

Quand l'app sera reprise, dans cet ordre :

1. **Modèle** : aligner les types TS sur les schémas server (`User`, `Bank` avec `currentBalance`, `Operation` avec `category` et sans `periodId`, ajouter `Category`)
2. **API HTTP** : aligner `src/api/` sur les routes actuelles, retirer toute référence à `Period`
3. **Repos SQLite** : ajouter `categories`, `category_hints` ; ajouter `current_balance` à `banks` ; supprimer `periods` ; aligner les colonnes des autres tables
4. **Auth** : remplacer username → email, gérer `emailVerified`, ajouter écran d'inscription avec CGU
5. **Écrans** :
   - Dashboard : plage de dates `startDate/endDate` (pas mois/année), badge solde projeté
   - Banks : édition `currentBalance`
   - Categories (nouveau)
   - Recurring : champ catégorie
   - Profile : champs étendus, avatar (avec recadrage si possible)
6. **Import** (optionnel sur mobile) : QIF/OFX via `expo-document-picker`

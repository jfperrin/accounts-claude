# Architecture du client

Application React/Vite de gestion de comptes bancaires personnels.
Communique avec le serveur Express via une API REST `/api/*`.

---

## Structure des fichiers

```
client/src/
├── main.jsx                    # Point d'entrée : thème Ant Design, locale FR, AuthProvider
├── App.jsx                     # Routeur : routes publiques / protégées
│
├── store/
│   └── AuthContext.jsx         # État d'authentification global (Context + hook useAuth)
│
├── api/                        # Couche d'accès à l'API REST
│   ├── client.js               # Instance Axios partagée
│   ├── auth.js                 # /api/auth/*
│   ├── banks.js                # /api/banks/*
│   ├── operations.js           # /api/operations/*
│   ├── periods.js              # /api/periods/*
│   └── recurringOperations.js  # /api/recurring-operations/*
│
├── pages/                      # Composants de page (un par route)
│   ├── LoginPage.jsx           # Connexion / inscription
│   ├── DashboardPage.jsx       # Vue principale : sélecteur de période + opérations
│   ├── BanksPage.jsx           # Gestion des banques
│   └── RecurringPage.jsx       # Gestion des opérations récurrentes
│
└── components/                 # Composants réutilisables
    ├── layout/
    │   └── AppShell.jsx        # Mise en page globale : sidebar + header + <Outlet>
    ├── BankBalances.jsx        # Cartes de solde par banque
    ├── OperationsTable.jsx     # Tableau des opérations d'une période
    └── OperationForm.jsx       # Modal de création / modification d'une opération
```

---

## Point d'entrée (`main.jsx`)

Configure trois choses avant de monter l'application :

1. **Locale française** — `dayjs.locale('fr')` + `<ConfigProvider locale={frFR}>` d'Ant Design pour les dates, messages de validation, etc.
2. **Thème Ant Design** — tokens personnalisés (couleur primaire indigo `#6366f1`, police *Plus Jakarta Sans*, sidebar sombre). Définis une seule fois ici, appliqués à tous les composants antd.
3. **AuthProvider** — enveloppe toute l'app pour rendre l'état d'authentification accessible partout via `useAuth()`.

---

## Authentification (`store/AuthContext.jsx`)

Gère l'état de session en trois valeurs possibles pour `user` :

| Valeur | Signification |
|--------|--------------|
| `undefined` | Chargement en cours (vérifie la session au montage) |
| `null` | Non authentifié |
| `{ _id, username }` | Authentifié |

**Au montage** : appel `GET /api/auth/me` pour restaurer une session existante.  
**`login()`** / **`register()`** : appellent l'API puis mettent `user` à jour.  
**`logout()`** : appelle `POST /api/auth/logout` puis remet `user` à `null`.

Le hook `useAuth()` est le seul point d'accès à cet état depuis les composants.

---

## Routeur (`App.jsx`)

```
/login          → LoginPage        (public, redirige vers / si déjà connecté)
/               → AppShell
  /             → DashboardPage    (protégé)
  /banks        → BanksPage        (protégé)
  /recurring    → RecurringPage    (protégé)
```

**`<PrivateRoute>`** : affiche un spinner tant que `user === undefined`, redirige vers `/login` si `user === null`, laisse passer si authentifié.

---

## Couche API (`api/`)

### `client.js`
Instance Axios configurée avec :
- `baseURL: '/api'` — le proxy Vite redirige `/api` vers `http://localhost:3001`
- `withCredentials: true` — indispensable pour transmettre le cookie de session cross-port en dev
- **Intercepteur de réponse** : retourne directement `res.data` (les fonctions d'API ne reçoivent pas d'objet `AxiosResponse` complet, juste les données)

### Fichiers de ressources
Chaque fichier exporte des fonctions nommées correspondant aux opérations CRUD :

```js
// Exemple : api/banks.js
export const list   = ()         => client.get('/banks')
export const create = (data)     => client.post('/banks', data)
export const update = (id, data) => client.put(`/banks/${id}`, data)
export const remove = (id)       => client.delete(`/banks/${id}`)
```

Les erreurs remontent telles quelles (`err.response?.data || err`) pour être gérées dans les composants.

---

## Pages

### `LoginPage.jsx`
- Deux onglets (Connexion / Inscription) implémentés comme des boutons toggle custom (pas de `<Tabs>` antd) pour un contrôle total du style.
- Vérifie au montage si Google OAuth est activé (`GET /api/auth/config`) pour afficher ou non le bouton Google.
- Le paramètre `?error=google` dans l'URL (posé par le serveur en cas d'échec OAuth) déclenche une alerte d'erreur.

### `DashboardPage.jsx`
Page principale — orchestre tous les autres composants.

**État local :**
| State | Rôle |
|-------|------|
| `month` / `year` | Période sélectionnée |
| `periods` | Toutes les périodes de l'utilisateur |
| `selectedPeriod` | Période correspondant au mois/an sélectionné (`null` si inexistante) |
| `banks` | Banques de l'utilisateur |
| `operations` | Opérations de la période sélectionnée |
| `formOpen` / `editOp` | Contrôle du modal de formulaire |

**Flux principal :**
1. Au montage : charge en parallèle les périodes et les banques (`Promise.all`)
2. Quand `month`, `year` ou `periods` changent : cherche la période correspondante ; si elle existe, charge ses opérations
3. `ensurePeriod()` : crée la période si elle n'existe pas encore (appelé avant toute écriture)

**Fonctions clés :**

- `handleImport()` — importe les récurrentes dans la période (`POST /api/operations/import-recurring`)
- `handleSaveBalance(bankId, value)` — met à jour un solde initial de banque pour la période
- `handleFormFinish(values)` — crée ou modifie une opération
- `handlePoint(id)` — inverse l'état pointé d'une opération
- `handleDelete(id)` — supprime une opération

### `BanksPage.jsx`
CRUD simple : tableau + modal. Les colonnes du tableau sont mémoïsées avec `useMemo` pour éviter de les recréer à chaque rendu.

### `RecurringPage.jsx`
Identique à `BanksPage` avec un formulaire plus riche (banque, jour du mois, montant). Les colonnes sont également mémoïsées.

---

## Composants

### `AppShell.jsx`
Mise en page persistante autour des pages protégées.

- **Sidebar** (antd `<Sider>`) : navigation avec les 3 routes, thème sombre, logo avec icône gradient
- **Header** : avatar avec initiales de l'utilisateur, bouton de déconnexion
- **`<Outlet />`** : zone de contenu où React Router injecte la page active

La route active est mise en évidence via `selectedKeys={[pathname]}`.

### `BankBalances.jsx`
Affiche une carte par banque avec :
- **Solde initial** — éditable en ligne (clic sur le crayon → `InputNumber` → blur/entrée pour sauvegarder)
- **Solde prévisionnel** — `solde_initial + somme(opérations non pointées de cette banque)` — calculé localement sans appel API
- **Carte total** — affichée si l'utilisateur a plusieurs banques avec des soldes saisis

`BankCard` est enveloppé dans `React.memo` : une modification de solde sur une carte ne re-rend pas les autres.

### `OperationsTable.jsx`
Tableau antd avec tri par date par défaut.

- La colonne **Pointé** utilise un `<Switch>` qui appelle `onPoint` directement
- Les lignes pointées reçoivent la classe CSS `op-pointed` (opacity 0.5, définie par un `<style>` inline dans `DashboardPage`)
- Les colonnes sont mémoïsées avec `useMemo([onPoint, onEdit, onDelete])` pour éviter la recréation à chaque rendu du parent

### `OperationForm.jsx`
Modal antd avec un formulaire de 4 champs (libellé, banque, date, montant).

- `useEffect([open, operation])` : réinitialise le formulaire à chaque ouverture — prérempli si édition, valeurs par défaut si création
- La date antd (`dayjs`) est convertie en ISO string avant envoi à l'API
- `destroyOnClose` : le composant est démonté à la fermeture, le `useEffect` suffit donc pour l'initialisation

---

## Modèle de données côté client

Les objets reçus de l'API ont la forme suivante :

```js
// Bank
{ _id, label, userId }

// Period
{ _id, month, year, userId, balances: { bankId: number } }

// Operation
{ _id, label, amount, date, pointed, bankId: { _id, label }, periodId, userId }

// RecurringOperation
{ _id, label, amount, dayOfMonth, bankId: { _id, label }, userId }
```

`bankId` est toujours **populé** dans les réponses des routes opérations et récurrentes : le client peut afficher le nom de la banque sans requête supplémentaire.

---

## Calculs côté client

Le serveur ne calcule pas les soldes — c'est délibéré pour garder la logique simple et le serveur sans état métier.

| Calcul | Où | Formule |
|--------|----|---------|
| Solde prévisionnel d'une banque | `BankBalances.jsx` | `solde_initial + Σ amount(opérations non pointées de cette banque)` |
| Total prévisionnel toutes banques | `BankBalances.jsx` | `Σ soldes_initiaux + Σ amount(toutes opérations non pointées)` |

---

## Conventions

- **Pas de gestionnaire d'état global** (pas de Redux/Zustand) : l'état est local aux pages, levé uniquement là où nécessaire (auth dans Context)
- **Pas de React Query / SWR** : les chargements sont gérés manuellement avec `useEffect` + `useState`
- **Nommage** : `handle*` pour les callbacks d'événements, `load*` pour les fonctions de chargement de données
- **Formulaires** : antd `Form` avec `form.setFieldsValue()` pour pré-remplir, `form.submit()` déclenché depuis le bouton OK du Modal

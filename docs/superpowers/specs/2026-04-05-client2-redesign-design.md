c'est tout bon# Client2 — Redesign sans antd

**Date :** 2026-04-05  
**Scope :** Nouveau répertoire `client2/` remplaçant `client/` — mêmes fonctionnalités, stack UI entièrement remplacée.

---

## Contexte

L'application `client/` utilise Ant Design 6 comme bibliothèque UI. L'objectif est de recréer l'intégralité du client dans `client2/` avec une stack moderne sans antd, tout en conservant la même API layer, le même AuthContext et les mêmes comportements fonctionnels.

---

## Stack

| Outil | Version | Rôle |
|-------|---------|------|
| Vite | 6.x | Bundler |
| React | 19.x | UI framework |
| Tailwind CSS | 4.x | Styles utilitaires (`@import "tailwindcss"`) |
| shadcn/ui | latest | Composants (Radix UI) copiés dans `src/components/ui/` |
| Lucide React | latest | Icônes |
| react-router-dom | 7.x | Routing (inchangé) |
| axios | 1.x | HTTP client (inchangé) |
| dayjs | 1.x | Dates (inchangé) |
| sonner | latest | Toasts (remplace `message` antd) |
| clsx + tailwind-merge | latest | Helper `cn()` |
| Vitest + Testing Library | latest | Tests (inchangés) |

---

## Structure des fichiers

```
client2/
├── index.html
├── package.json
├── vite.config.js
├── components.json           # config shadcn/ui
└── src/
    ├── main.jsx              # entry point, Inter font, Toaster
    ├── App.jsx               # routing, PrivateRoute, spinner custom
    ├── lib/
    │   └── utils.js          # cn() = clsx + tailwind-merge
    ├── api/                  # copie exacte de client/src/api/
    │   ├── client.js
    │   ├── auth.js
    │   ├── banks.js
    │   ├── operations.js
    │   ├── periods.js
    │   └── recurringOperations.js
    ├── store/
    │   └── AuthContext.jsx   # inchangé
    ├── components/
    │   ├── ui/               # composants shadcn générés
    │   │   ├── button.jsx
    │   │   ├── input.jsx
    │   │   ├── label.jsx
    │   │   ├── select.jsx
    │   │   ├── dialog.jsx
    │   │   ├── table.jsx
    │   │   ├── switch.jsx
    │   │   ├── badge.jsx
    │   │   ├── separator.jsx
    │   │   ├── avatar.jsx
    │   │   ├── tooltip.jsx
    │   │   └── popover.jsx
    │   ├── layout/
    │   │   └── AppShell.jsx
    │   ├── BankBalances.jsx
    │   ├── OperationsTable.jsx
    │   └── OperationForm.jsx
    └── pages/
        ├── LoginPage.jsx
        ├── DashboardPage.jsx
        ├── BanksPage.jsx
        └── RecurringPage.jsx
```

---

## Système visuel

### Palette

| Usage | Classe Tailwind | Valeur |
|-------|----------------|--------|
| Fond layout | `bg-slate-50` | #f8fafc |
| Surface card | `bg-white` | #ffffff |
| Bordures | `border-slate-200` | #e2e8f0 |
| Texte principal | `text-slate-900` | #0f172a |
| Texte secondaire | `text-slate-500` | #64748b |
| Accent primaire | `bg-indigo-600` | #4f46e5 |
| Accent hover | `hover:bg-indigo-700` | #4338ca |
| Crédit/succès | `text-emerald-600` | #059669 |
| Débit/danger | `text-rose-600` | #e11d48 |
| Sider | `bg-slate-900` | #0f172a |

### Typographie

- Font : **Inter** via Google Fonts (`font-sans`)
- Base : 14px (`text-sm`)
- Labels : 12px (`text-xs`)
- Montants importants : 22–24px (`text-2xl font-bold`)

### Composants

- Cards : `rounded-xl border border-slate-200 shadow-sm bg-white`
- Bouton primaire : `bg-indigo-600 hover:bg-indigo-700 text-white font-semibold`
- Inputs : hauteur 40px, `border-slate-200 focus:ring-indigo-500`
- Tables : `text-sm`, header `bg-slate-50 text-slate-500 uppercase text-xs font-semibold tracking-wide`

---

## Pages & Comportements

### LoginPage

- Fond `bg-slate-900` avec 3 glows radial indigo/violet (conservés)
- Card blanche `w-[420px] rounded-2xl shadow-2xl p-12`
- Logo gradient indigo, titre "Gestion de Comptes", sous-titre
- Toggle Connexion/Inscription : pill custom Tailwind, actif `bg-indigo-600 text-white`
- Bouton Google OAuth conditionnel (si `googleEnabled`)
- Alerte erreur Google en haut
- Inputs shadcn Input + Label
- Bouton submit pleine largeur, loading state

### AppShell

- **Sider** `w-60` (étendu) / `w-16` (réduit), `bg-slate-900`
  - Logo en haut : icône gradient + "Comptes" (masqué si réduit)
  - Nav items avec `ChevronRight` → `ChevronLeft` pour toggle
  - Item actif : `bg-indigo-600 rounded-lg text-white`
  - Item inactif : `text-slate-400 hover:text-white hover:bg-slate-800`
- **Header** `bg-white border-b border-slate-200 h-14`
  - Droite : Avatar (initiales, fond indigo), username, bouton logout (`LogOut` Lucide)
- **Content** : `bg-slate-50 flex-1 p-6`

### DashboardPage

- Barre de contrôle dans une card : sélecteur mois (shadcn Select) + année + bouton "Importer récurrentes" (outline) + bouton "Nouvelle opération" (primaire)
- `BankBalances` au-dessus des opérations, séparé par un `Separator`
- Si aucune opération : message centré "Aucune opération pour cette période"
- Sinon : card avec en-tête `{mois} {année}` + compteur, puis `OperationsTable`

### BankBalances

- Grille responsive : `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- Chaque `BankCard` :
  - Header : icône Building2 indigo + nom de banque
  - "Solde actuel" : montant éditable inline (click sur `Pencil` Lucide → Input)
  - "Prévisionnel" : montant coloré (emerald si ≥ 0, rose si < 0)
- Card "Total prévisionnel" : gradient `from-indigo-600 to-violet-600`, texte blanc, si ≥ 2 banques avec solde

### OperationsTable

- Table shadcn, colonnes : Date | Libellé | Banque | Montant | Pointé | Actions
- Lignes pointées : `opacity-50`
- Banque : Badge shadcn `variant="secondary"`
- Montant : `text-emerald-600 font-semibold` (crédit) / `text-rose-600 font-semibold` (débit)
- Pointé : Switch shadcn
- Actions : boutons icônes `Edit` + `Trash2`, confirmation delete via Dialog (pas de Popconfirm antd)

### OperationForm (Dialog)

- Dialog shadcn (remplace Modal antd)
- Champs : Libellé (Input), Banque (Select), Date (Input type="date"), Montant (Input type="number")
- Footer : Annuler + Enregistrer

### BanksPage

- Header : titre "Banques" + bouton "Ajouter"
- Table shadcn : colonne Libellé + colonne actions (Edit + Delete)
- Dialog pour création/modification (Input label)

### RecurringPage

- Header : titre "Opérations récurrentes" + bouton "Ajouter"
- Table : Libellé | Banque (Badge) | Jour | Montant coloré | Actions
- Dialog : Libellé, Banque (Select), Jour du mois (Select 1–31), Montant (Input number)

---

## Feedback utilisateur

`message.success/error` antd remplacé par `sonner` :

```js
import { toast } from 'sonner';
toast.success('Enregistré');
toast.error('Erreur');
```

`<Toaster />` monté dans `main.jsx`.

---

## Spinner de chargement

Remplace `<Spin fullscreen />` antd par un div centré avec `animate-spin` Tailwind sur une icône `Loader2` Lucide.

---

## Tests

Fichiers de tests copiés/adaptés depuis `client/src/tests/` — mêmes comportements testés, imports mis à jour (suppression des mocks antd).

---

## Ce qui ne change pas

- `src/api/` — copie exacte
- `src/store/AuthContext.jsx` — copie exacte
- Logique métier dans toutes les pages — inchangée
- Vite proxy `/api` → `:3001` — inchangé
- Port : `:5174` (Vite auto-incrémente)

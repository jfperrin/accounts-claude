# History Page — Historique des soldes

**Date:** 2026-04-07  
**Scope:** Web client (`client/`) uniquement  
**Route:** `/history`

---

## Objectif

Nouvelle page affichant l'évolution du solde prévisionnel total (toutes banques) sur toutes les périodes existantes, avec des cartes de résumé et une courbe area interactive.

---

## Données

### Source
- `periodsApi.list()` — charge toutes les périodes de l'utilisateur
- `operationsApi.list(periodId)` — chargé en parallèle via `Promise.all` pour chaque période

### Calcul du solde prévisionnel par période
Pour chaque période :
1. Filtrer les opérations non-pointées (`!op.pointed`)
2. Sommer par `bankId` : `unpointedSums[bankId] += op.amount`
3. Pour chaque banque ayant un `balances[bankId]` défini : `projected = balances[bankId] + unpointedSums[bankId]`
4. `totalProjected = Σ projected` sur toutes les banques avec un solde initial saisi

Une période est **exclue du graphique** si aucune banque n'a de solde initial saisi (`balances` vide ou absent).

### Tri
Périodes triées chronologiquement : par `year` ASC puis `month` ASC.

### Label X-axis
Format court : `"Jan 25"`, `"Fév 25"`, etc. (mois abrégé + 2 derniers chiffres de l'année).

---

## Composants et structure

### Nouveau fichier
`client/src/pages/HistoryPage.jsx`

### Structure de la page
```
<div class="space-y-6">
  <!-- 3 cartes résumé (grid responsive) -->
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
    <SummaryCard label="Solde actuel" />
    <SummaryCard label="Évolution" />
    <SummaryCard label="Meilleur mois" />
  </div>

  <!-- Carte graphique -->
  <div class="rounded-xl border bg-card p-4 shadow-xs">
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        ...
      </AreaChart>
    </ResponsiveContainer>
  </div>
</div>
```

### Cartes résumé (3)

| Carte | Valeur | Condition d'affichage |
|-------|--------|-----------------------|
| Solde actuel | `totalProjected` de la période la plus récente | Toujours (affiche `—` si aucune donnée) |
| Évolution | `((actuel - précédent) / abs(précédent)) * 100` | Masquée si < 2 périodes |
| Meilleur mois | Label de la période avec le `totalProjected` le plus élevé | Masquée si < 1 période |

### Graphique (Recharts)

- `AreaChart` avec `ResponsiveContainer width="100%" height={280}`
- `Area` : `type="monotone"`, `dataKey="total"`, `stroke="#6366f1"`, `strokeWidth={2.5}`, fill via `<defs><linearGradient>` indigo→transparent
- `XAxis` : `dataKey="label"`, tick style muted
- `YAxis` : `tickFormatter` → `formatEur` simplifié (ex: `"4 200 €"`)
- `CartesianGrid` : `strokeDasharray="4 3"`, couleur `#f1f5f9`
- `Tooltip` : fond `#0f172a`, texte blanc, affiche mois + montant formaté `formatEur`
- `dot` : `false` (pas de points permanents), `activeDot` : cercle indigo avec bordure blanche

---

## Navigation

### Desktop — `AppShell.jsx` `NAV_ITEMS`
Ajouter après "Récurrentes" :
```js
{ key: '/history', icon: TrendingUp, label: 'Historique' }
```

### Mobile — `AppShell.jsx` `BOTTOM_TABS`
Ajouter comme 5ème onglet (avant Profil) :
```js
{ key: '/history', icon: TrendingUp, label: 'Historique' }
```

### Router — `App.jsx`
```jsx
import HistoryPage from '@/pages/HistoryPage';
// ...
<Route path="history" element={<HistoryPage />} />
```

---

## Dépendance

Recharts doit être ajouté :
```bash
yarn --cwd client add recharts
```

---

## Responsive

| Breakpoint | Cartes résumé | Graphique |
|------------|---------------|-----------|
| Mobile (`< sm`) | 1 colonne | `height={200}`, labels X réduits |
| Desktop (`≥ sm`) | 3 colonnes | `height={280}` |

Le composant `ResponsiveContainer` de Recharts gère le redimensionnement automatiquement. La hauteur du graphique est fixée via prop ou breakpoint Tailwind inline.

---

## États de chargement et cas limites

- **Chargement** : spinner centré (même pattern que le spinner global de `App.jsx`)
- **Aucune période** : message vide (`"Aucune donnée disponible"`) avec icône `TrendingUp` opacité 30%
- **Périodes sans solde initial** : exclues silencieusement du graphique
- **Une seule période** : graphique affiché (un seul point), carte "Évolution" masquée

---

## Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `client/src/pages/HistoryPage.jsx` | **Nouveau** |
| `client/src/App.jsx` | Import + route `/history` |
| `client/src/components/layout/AppShell.jsx` | `NAV_ITEMS` + `BOTTOM_TABS` |
| `client/package.json` | Ajout `recharts` |

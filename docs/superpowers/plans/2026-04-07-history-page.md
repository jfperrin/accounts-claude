# History Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page `/history` dans le web client affichant une courbe area du solde prévisionnel total (toutes banques, initial + non-pointées) par période, avec 3 cartes résumé.

**Architecture:** Deux fonctions pures extraites dans `historyUtils.js` (testables sans DOM), consommées par `HistoryPage.jsx` qui charge les données via Promise.all sur toutes les périodes. Recharts gère le rendu du graphique.

**Tech Stack:** React, Recharts (`AreaChart` + `ResponsiveContainer`), Vitest + @testing-library/react, Tailwind CSS v4, shadcn/ui design tokens.

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `client/src/lib/historyUtils.js` | Créer | Fonctions pures : `computeChartData` et `computeSummary` |
| `client/src/tests/historyUtils.test.js` | Créer | Tests unitaires des deux fonctions |
| `client/src/pages/HistoryPage.jsx` | Créer | Page React avec cartes résumé + graphique |
| `client/src/tests/HistoryPage.test.jsx` | Créer | Tests composant (APIs mockées, Recharts mocké) |
| `client/src/App.jsx` | Modifier | Import + route `/history` |
| `client/src/components/layout/AppShell.jsx` | Modifier | `NAV_ITEMS` (desktop) + `BOTTOM_TABS` (mobile) |
| `client/package.json` | Modifier | Dépendance `recharts` |

---

## Task 1 — Installer recharts

**Files:**
- Modify: `client/package.json`

- [ ] **Step 1 : Installer recharts**

```bash
yarn --cwd client add recharts
```

Résultat attendu : `recharts` apparaît dans `client/package.json` sous `dependencies`.

- [ ] **Step 2 : Vérifier que les tests existants passent toujours**

```bash
yarn --cwd client test
```

Résultat attendu : tous les tests passent (aucune régression).

- [ ] **Step 3 : Commit**

```bash
git add client/package.json client/yarn.lock
git commit -m "chore(client): add recharts"
```

---

## Task 2 — Utilitaires de calcul (`historyUtils.js`)

**Files:**
- Create: `client/src/lib/historyUtils.js`
- Create: `client/src/tests/historyUtils.test.js`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `client/src/tests/historyUtils.test.js` :

```javascript
import { computeChartData, computeSummary } from '../lib/historyUtils';

// ── computeChartData ──────────────────────────────────────────────────────────

const periods = [
  { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
  { _id: 'p2', month: 2, year: 2025, balances: { b1: 1200 } },
  { _id: 'p3', month: 3, year: 2025, balances: {} }, // pas de solde → exclu
];
const ops = {
  p1: [
    { bankId: 'b1', amount: -300, pointed: false },
    { bankId: 'b1', amount: -100, pointed: true }, // pointée → ignorée
  ],
  p2: [],
  p3: [],
};

describe('computeChartData', () => {
  it('exclut les périodes sans solde initial', () => {
    const data = computeChartData(periods, ops);
    expect(data).toHaveLength(2);
  });

  it('calcule total = solde initial + opérations non-pointées', () => {
    const data = computeChartData(periods, ops);
    expect(data[0].total).toBe(700);  // 1000 - 300
    expect(data[1].total).toBe(1200); // 1200 + 0
  });

  it('trie par année puis par mois', () => {
    const unsorted = [
      { _id: 'pa', month: 3, year: 2025, balances: { b1: 100 } },
      { _id: 'pb', month: 1, year: 2025, balances: { b1: 200 } },
      { _id: 'pc', month: 2, year: 2024, balances: { b1: 300 } },
    ];
    const data = computeChartData(unsorted, {});
    expect(data.map((d) => d.label)).toEqual(['Fév 24', 'Jan 25', 'Mar 25']);
  });

  it('formate le label en "Mmm AA"', () => {
    const data = computeChartData([periods[0]], ops);
    expect(data[0].label).toBe('Jan 25');
  });

  it('gère les bankId objets populés (form { _id: "..." })', () => {
    const p = [{ _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } }];
    const o = { p1: [{ bankId: { _id: 'b1' }, amount: -200, pointed: false }] };
    const data = computeChartData(p, o);
    expect(data[0].total).toBe(800);
  });

  it('retourne un tableau vide si toutes les périodes sont sans solde', () => {
    const p = [{ _id: 'p1', month: 1, year: 2025, balances: {} }];
    expect(computeChartData(p, {})).toEqual([]);
  });
});

// ── computeSummary ────────────────────────────────────────────────────────────

describe('computeSummary', () => {
  it('retourne tout à null si chartData est vide', () => {
    expect(computeSummary([])).toEqual({ current: null, evolution: null, best: null });
  });

  it('current = total de la dernière période', () => {
    const data = [{ label: 'Jan 25', total: 1000 }, { label: 'Fév 25', total: 1200 }];
    expect(computeSummary(data).current).toBe(1200);
  });

  it('calcule evolution en % par rapport à la période précédente', () => {
    const data = [{ label: 'Jan 25', total: 1000 }, { label: 'Fév 25', total: 1200 }];
    expect(computeSummary(data).evolution).toBeCloseTo(20);
  });

  it('evolution est null avec une seule période', () => {
    expect(computeSummary([{ label: 'Jan 25', total: 1000 }]).evolution).toBeNull();
  });

  it('identifie le meilleur mois', () => {
    const data = [
      { label: 'Jan 25', total: 1000 },
      { label: 'Fév 25', total: 1500 },
      { label: 'Mar 25', total: 1200 },
    ];
    expect(computeSummary(data).best).toEqual({ label: 'Fév 25', total: 1500 });
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
yarn --cwd client test historyUtils
```

Résultat attendu : erreurs `Cannot find module '../lib/historyUtils'`.

- [ ] **Step 3 : Implémenter `historyUtils.js`**

Créer `client/src/lib/historyUtils.js` :

```javascript
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

/**
 * Transforme les périodes et leurs opérations en points de données pour le graphique.
 * Les périodes sans solde initial (balances vide) sont exclues.
 * Le résultat est trié chronologiquement (année ASC, mois ASC).
 *
 * @param {Array}  periods              Liste des périodes (model Period)
 * @param {Object} operationsByPeriodId { [periodId]: Operation[] }
 * @returns {{ label: string, total: number }[]}
 */
export function computeChartData(periods, operationsByPeriodId) {
  return periods
    .slice()
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    .reduce((acc, period) => {
      const balances = period.balances ?? {};
      const bankIds = Object.keys(balances);
      if (bankIds.length === 0) return acc;

      const ops = operationsByPeriodId[period._id] ?? [];
      const unpointedSums = {};
      for (const op of ops) {
        if (!op.pointed) {
          const bid = op.bankId?._id ?? op.bankId;
          unpointedSums[bid] = (unpointedSums[bid] ?? 0) + op.amount;
        }
      }

      const total = bankIds.reduce(
        (s, bid) => s + balances[bid] + (unpointedSums[bid] ?? 0),
        0
      );

      const year2 = String(period.year).slice(2);
      const label = `${MONTHS_SHORT[period.month - 1]} ${year2}`;
      return [...acc, { label, total }];
    }, []);
}

/**
 * Calcule les indicateurs résumé à partir des données du graphique.
 *
 * @param {{ label: string, total: number }[]} chartData
 * @returns {{
 *   current: number|null,
 *   evolution: number|null,
 *   best: { label: string, total: number }|null
 * }}
 */
export function computeSummary(chartData) {
  if (chartData.length === 0) return { current: null, evolution: null, best: null };

  const current = chartData[chartData.length - 1].total;

  const previous = chartData.length >= 2 ? chartData[chartData.length - 2].total : null;
  const evolution =
    previous !== null && previous !== 0
      ? ((current - previous) / Math.abs(previous)) * 100
      : null;

  const best = chartData.reduce((b, d) => (d.total > b.total ? d : b), chartData[0]);

  return { current, evolution, best };
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
yarn --cwd client test historyUtils
```

Résultat attendu : 11 tests passent, 0 échec.

- [ ] **Step 5 : Commit**

```bash
git add client/src/lib/historyUtils.js client/src/tests/historyUtils.test.js
git commit -m "feat(client): add historyUtils — computeChartData and computeSummary"
```

---

## Task 3 — Page `HistoryPage.jsx`

**Files:**
- Create: `client/src/pages/HistoryPage.jsx`
- Create: `client/src/tests/HistoryPage.test.jsx`

- [ ] **Step 1 : Écrire les tests qui échouent**

Créer `client/src/tests/HistoryPage.test.jsx` :

```jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

// Recharts n'est pas compatible avec happy-dom (SVG/canvas) — on le mocke entièrement.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

vi.mock('@/api/periods', () => ({ list: vi.fn() }));
vi.mock('@/api/operations', () => ({ list: vi.fn() }));

import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import HistoryPage from '../pages/HistoryPage';

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche un spinner pendant le chargement', () => {
    periodsApi.list.mockReturnValue(new Promise(() => {})); // ne résout jamais
    render(<HistoryPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('affiche le message vide quand aucune période n\'a de solde', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: {} },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByText('Aucune donnée disponible')).toBeInTheDocument()
    );
  });

  it('affiche le graphique et les 3 cartes résumé avec des données', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
      { _id: 'p2', month: 2, year: 2025, balances: { b1: 1500 } },
    ]);
    operationsApi.list.mockImplementation((periodId) =>
      Promise.resolve(
        periodId === 'p1'
          ? [{ bankId: 'b1', amount: -200, pointed: false }]
          : []
      )
    );

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    );
    expect(screen.getByText('Solde actuel')).toBeInTheDocument();
    expect(screen.getByText('Évolution')).toBeInTheDocument();
    expect(screen.getByText('Meilleur mois')).toBeInTheDocument();
  });

  it("n'affiche pas la carte Évolution avec une seule période", async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 1000 } },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByText('Solde actuel')).toBeInTheDocument()
    );
    expect(screen.queryByText('Évolution')).not.toBeInTheDocument();
  });

  it('charge les opérations pour chaque période en parallèle', async () => {
    periodsApi.list.mockResolvedValue([
      { _id: 'p1', month: 1, year: 2025, balances: { b1: 500 } },
      { _id: 'p2', month: 2, year: 2025, balances: { b1: 600 } },
    ]);
    operationsApi.list.mockResolvedValue([]);

    render(<HistoryPage />);

    await waitFor(() =>
      expect(screen.getByTestId('area-chart')).toBeInTheDocument()
    );
    expect(operationsApi.list).toHaveBeenCalledWith('p1');
    expect(operationsApi.list).toHaveBeenCalledWith('p2');
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
yarn --cwd client test HistoryPage
```

Résultat attendu : `Cannot find module '../pages/HistoryPage'`.

- [ ] **Step 3 : Implémenter `HistoryPage.jsx`**

Créer `client/src/pages/HistoryPage.jsx` :

```jsx
import { useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import * as periodsApi from '@/api/periods';
import * as operationsApi from '@/api/operations';
import { formatEur } from '@/lib/utils';
import { computeChartData, computeSummary } from '@/lib/historyUtils';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [summary, setSummary] = useState({ current: null, evolution: null, best: null });

  useEffect(() => {
    async function load() {
      const periods = await periodsApi.list();
      const opsByPeriod = Object.fromEntries(
        await Promise.all(
          periods.map(async (p) => [p._id, await operationsApi.list(p._id)])
        )
      );
      const data = computeChartData(periods, opsByPeriod);
      setChartData(data);
      setSummary(computeSummary(data));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <TrendingUp className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">Aucune donnée disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Cartes résumé ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Solde actuel */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Solde actuel
          </p>
          <p className={`text-2xl font-extrabold ${summary.current >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatEur(summary.current)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Période la plus récente</p>
        </div>

        {/* Évolution — masquée si < 2 périodes */}
        {summary.evolution !== null && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Évolution
            </p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                summary.evolution >= 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {summary.evolution >= 0 ? '▲' : '▼'} {Math.abs(summary.evolution).toFixed(1)} %
            </span>
            <p className="mt-2 text-xs text-muted-foreground">vs période précédente</p>
          </div>
        )}

        {/* Meilleur mois */}
        {summary.best !== null && (
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Meilleur mois
            </p>
            <p className="mt-1 text-lg font-bold text-indigo-600">{summary.best.label}</p>
            <p className="text-xs text-muted-foreground">{formatEur(summary.best.total)}</p>
          </div>
        )}
      </div>

      {/* ── Graphique ── */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="mb-4">
          <p className="font-semibold text-foreground">Évolution du solde prévisionnel</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Toutes banques · solde initial + opérations non-pointées
          </p>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: 'none',
                borderRadius: 8,
                color: 'white',
                fontSize: 12,
              }}
              formatter={(value) => [formatEur(value), 'Solde']}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="url(#colorTotal)"
              dot={false}
              activeDot={{ r: 5, fill: '#6366f1', stroke: 'white', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
yarn --cwd client test HistoryPage
```

Résultat attendu : 5 tests passent, 0 échec.

- [ ] **Step 5 : Lancer tous les tests**

```bash
yarn --cwd client test
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6 : Commit**

```bash
git add client/src/pages/HistoryPage.jsx client/src/tests/HistoryPage.test.jsx
git commit -m "feat(client): add HistoryPage with area chart and summary cards"
```

---

## Task 4 — Navigation et route

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/layout/AppShell.jsx`

- [ ] **Step 1 : Ajouter la route dans `App.jsx`**

Dans `client/src/App.jsx`, ajouter l'import et la route :

```jsx
// Ajout après l'import de RecurringPage
import HistoryPage from '@/pages/HistoryPage';

// Dans <Route path="/" ...> ajouter après la route recurring :
<Route path="history" element={<HistoryPage />} />
```

Le fichier complet après modification :

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import LoginPage from '@/pages/LoginPage';
import AppShell from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import BanksPage from '@/pages/BanksPage';
import RecurringPage from '@/pages/RecurringPage';
import ProfilePage from '@/pages/ProfilePage';
import HistoryPage from '@/pages/HistoryPage';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="banks" element={<BanksPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2 : Mettre à jour `AppShell.jsx`**

Dans `client/src/components/layout/AppShell.jsx`, ajouter `TrendingUp` à l'import lucide et mettre à jour `NAV_ITEMS` et `BOTTOM_TABS` :

```jsx
// Ligne d'import lucide — remplacer par :
import { LayoutDashboard, Building2, RefreshCw, LogOut, ChevronLeft, ChevronRight, Wallet, UserCircle, TrendingUp } from 'lucide-react';

// NAV_ITEMS — remplacer par :
const NAV_ITEMS = [
  { key: '/',          icon: LayoutDashboard, label: 'Tableau de bord' },
  { key: '/banks',     icon: Building2,       label: 'Banques' },
  { key: '/recurring', icon: RefreshCw,       label: 'Opérations récurrentes' },
  { key: '/history',   icon: TrendingUp,      label: 'Historique' },
];

// BOTTOM_TABS — remplacer par :
const BOTTOM_TABS = [
  { key: '/',          icon: LayoutDashboard, label: 'Accueil' },
  { key: '/banks',     icon: Building2,       label: 'Banques' },
  { key: '/recurring', icon: RefreshCw,       label: 'Récurrents' },
  { key: '/history',   icon: TrendingUp,      label: 'Historique' },
  { key: '/profile',   icon: UserCircle,      label: 'Profil' },
];
```

- [ ] **Step 3 : Lancer tous les tests**

```bash
yarn --cwd client test
```

Résultat attendu : tous les tests passent.

- [ ] **Step 4 : Vérifier visuellement dans le navigateur**

```bash
yarn dev
```

- Ouvrir http://localhost:5173
- Vérifier que l'entrée "Historique" apparaît dans la sidebar desktop
- Vérifier que l'onglet "Historique" apparaît dans la bottom nav mobile (DevTools → mobile view)
- Naviguer vers `/history` et vérifier l'affichage du graphique et des cartes

- [ ] **Step 5 : Commit final**

```bash
git add client/src/App.jsx client/src/components/layout/AppShell.jsx
git commit -m "feat(client): wire /history route and nav items"
```

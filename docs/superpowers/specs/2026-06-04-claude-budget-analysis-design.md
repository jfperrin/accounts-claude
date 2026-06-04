# Analyse budgétaire mensuelle par Claude

Date : 2026-06-04
Statut : design validé, en attente d'implémentation

## Contexte et objectif

Ajouter une page dédiée `/analysis` qui envoie les opérations catégorisées de l'utilisateur à Claude (via l'API Anthropic, côté serveur) et restitue une analyse budgétaire mensuelle structurée. L'analyse doit :

- Couvrir un mois sélectionné, avec navigation prev/next comme `HomePage`.
- S'appuyer sur l'historique des 6 mois précédents (agrégé par catégorie).
- Comparer le réel au budget prévu par catégorie et **proposer des corrections de budget appliquables en un clic**.
- Être déclenchée manuellement par bouton (pas d'appel automatique à l'ouverture).
- Être cachée en DB pour éviter les rappels redondants, invalidée automatiquement quand les opérations du mois changent.

Cette feature complète — sans la remplacer — l'heuristique locale `useMonthlyInsights` qui alimente `HeroAlerts` sur le dashboard.

## Architecture

```
Client (/analysis)                   Serveur (Express 5)              Anthropic
─────────────────                    ──────────────────              ──────────
BudgetAnalysisPage                   routes/budgetAnalyses.js
  ├ MonthNavigator           ───▶    ├ GET  /api/budget-analyses ──┐
  ├ Bouton "Analyser"        ───▶    ├ POST /api/budget-analyses ──┼──▶ messages.create
  └ AnalysisDisplay                  └ POST /apply-suggestion       │   tool_choice forcé
      ├ Summary / Highlights         services/budgetAnalysisService │
      ├ Trends / Anomalies            ├ buildPayload                 │
      ├ CategoryDonut (recharts)      ├ digestOps (SHA-256)          │
      └ BudgetSuggestionsList         └ callAnthropic + validate     │
          └ "Appliquer" → PUT cat    db.budgetAnalyses repo ◀────────┘
                                       (sqlite + mongo, même API)
```

### Principes structurants

- **Une seule entrée serveur** pour appeler Claude : tout passe par `budgetAnalysisService.getOrCompute`. Pas de duplication du prompt ou du parsing.
- **Tool use forcé** côté Anthropic : `tool_choice: { type: "tool", name: "submit_budget_analysis" }`. La réponse est lue depuis `response.content[0].input` — pas de parsing JSON depuis du texte libre.
- **Prompt caching** : le system prompt et la définition d'outil portent `cache_control: { type: "ephemeral" }`. Économie attendue ~80 % du coût en entrée sur les régénérations.
- **Cache DB scoped (userId, year, month)** avec digest SHA-256 des opérations du mois. Le GET ne déclenche jamais d'appel Anthropic.

## Contrats de données

### Payload envoyé à Claude

```jsonc
{
  "month": "2026-06",
  "currency": "EUR",
  "categories": [
    {
      "id": "cat_abc",
      "label": "Courses",
      "kind": "debit",                  // "debit" | "credit"
      "monthlyBudget": 450,             // maxAmount + Σ récurrentes catégorie
      "isAuto": false
    }
  ],
  "currentMonth": {
    "operations": [
      { "date": "2026-06-03", "amount": -42.50, "categoryId": "cat_abc" }
      // pas de label, pas de bankId
    ]
  },
  "history": [
    {
      "month": "2026-05",
      "byCategory": [
        { "categoryId": "cat_abc", "totalDebit": 478.20, "totalCredit": 0, "opsCount": 23 }
      ]
    }
    // 6 entrées N-1 à N-6
  ]
}
```

Les libellés d'opérations et identifiants de banque ne quittent pas le serveur. Seuls les libellés de catégories (déjà partagés au sein de l'app) partent.

### Schéma de l'outil Anthropic (réponse forcée)

```jsonc
// tool: submit_budget_analysis
{
  "summary": "string (200 mots max, français, ton neutre)",
  "highlights": [
    { "title": "string", "detail": "string",
      "severity": "info|positive|warning|critical" }
  ],
  "anomalies": [
    { "title": "string", "detail": "string", "categoryId": "string|null" }
  ],
  "trends": [
    { "categoryId": "string",
      "direction": "up|down|stable",
      "magnitudePct": "number",
      "comment": "string" }
  ],
  "budgetSuggestions": [
    { "categoryId": "string",
      "currentBudget": "number",
      "suggestedBudget": "number",
      "rationale": "string (1 phrase)" }
  ],
  "categoryBreakdown": [
    { "categoryId": "string", "share": "number (0..1)", "amount": "number" }
  ]
}
```

Validation côté serveur : tous les `categoryId` retournés doivent appartenir à `req.user.id`. Toute violation = 502 sans écrire le cache.

### API serveur ↔ client

| Méthode | Route                                          | Entrée                          | Sortie                                                |
|--------:|------------------------------------------------|---------------------------------|-------------------------------------------------------|
| GET     | `/api/budget-analyses?year=Y&month=M`          | query                           | `{ analysis, cachedAt, opsDigest, stale }` ou `404`   |
| POST    | `/api/budget-analyses`                         | `{ year, month, force?: bool }` | `{ analysis, cachedAt, opsDigest, stale: false }`     |
| POST    | `/api/budget-analyses/apply-suggestion`        | `{ categoryId, suggestedBudget }` | `{ category }`                                       |

`stale: true` quand le digest stocké diffère du digest live (les opérations du mois ont changé depuis la dernière analyse).

Le POST `apply-suggestion` recalcule `maxAmount = suggestedBudget − Σ récurrentes de la catégorie` pour rester cohérent avec le modèle existant (`maxAmount` = complément au-delà des récurrentes).

## Page `/analysis` (client)

### Arborescence

```
pages/BudgetAnalysisPage.jsx
  PageHeader
    titre "Analyse budgétaire IA"
    MonthNavigator (← juin 2026 →)
    Bouton "Analyser ce mois"  |  "Régénérer" (si cache présent)
  États
    EmptyState  — pas encore d'analyse
    LoadingState — skeleton sections + "Claude analyse…"
    StaleBanner — "Cette analyse n'est plus à jour, régénérez"
    ErrorState  — 429 / 502 / 503 / réseau, avec retry
  AnalysisDisplay
    SummaryCard
    HighlightsList    — pastilles par severity
    AnomaliesList     — items cliquables
    TrendsList        — flèches up/down/stable + %
    CategoryDonut     — recharts, lazy()
    BudgetSuggestionsCard
      Ligne suggestion : badge catégorie, currentBudget → suggestedBudget,
                         rationale, Bouton "Appliquer"
      Post-applique : ligne grisée + check
```

### Machine d'état

```
idle ─click "Analyser"→ loading ─success→ ready
       (404 sur GET)                  ↑      └─click "Régénérer"→ loading
                                      │
                       cache hit ─────┘
loading ─error→ error ─retry→ loading
ready ─ops changed (stale)→ stale ─click "Régénérer"→ loading
```

### Navigation et persistance

- Cookie `analysis_month` persiste le dernier mois consulté (clé séparée de `home_month`).
- `MonthNavigator` borné à 24 mois en arrière (pour éviter un payload `history` vide).
- Sidebar desktop : nouvel item "Analyse" (icône `Sparkles` ou `Bot`).
- Bottom-nav mobile : 6e tab.

### Hook dédié

```
hooks/useBudgetAnalysis.js
  → { analysis, status, stale, run, applySuggestion, regenerate }
```

- `GET` au montage et au changement de mois.
- `POST` au clic "Analyser" / "Régénérer".
- `applySuggestion` met à jour de façon optimiste la liste locale (grisage immédiat de la ligne).

### Code-splitting

- `BudgetAnalysisPage` chargé via `lazy()` dans `App.jsx`.
- `CategoryDonut` (recharts) `lazy()` dans la page (reste hors du chunk principal de la page tant que pas d'analyse).

## Couche serveur

### Fichiers créés ou modifiés

```
server/
  routes/budgetAnalyses.js          (nouveau)
  services/budgetAnalysisService.js (nouveau)
  prompts/budgetAnalysisPrompt.js   (nouveau, system + tool schema)
  middleware/rateLimitAnalysis.js   (nouveau)
  db/sqlite.js                      (+ table budget_analyses + repo)
  db/mongo.js                       (+ schéma + repo)
  app.js                            (+ app.use('/api/budget-analyses', requireAuth, …))
  tests/budgetAnalyses.test.js      (nouveau, vitest)
  package.json                      (+ @anthropic-ai/sdk)
  .env.example                      (+ ANTHROPIC_API_KEY, ANTHROPIC_MODEL)
```

### Repo `budgetAnalyses` (interface SQLite ↔ Mongo identique)

```js
findOne({ userId, year, month })       // → row | null
upsert({ userId, year, month, opsDigest, response, model })
deleteByUser(userId)                   // cascade au delete user
```

- SQLite : `CREATE TABLE IF NOT EXISTS budget_analyses (...)` dans `initSchema`, idempotent. Index unique `(user_id, year, month)`. Colonne `response` en TEXT (JSON stringifié).
- Mongo : schéma Mongoose avec index composite unique. `response` en Mixed.

### Service `budgetAnalysisService.js`

```
async function getOrCompute({ db, userId, year, month, force }) {
  const ops      = await db.operations.findInRange(userId, year, month)
  const history  = await db.operations.findInRange(userId, sixMonthsBack, ...)
  const cats     = await db.categories.list(userId)
  const recurr   = await db.recurringOps.list(userId)

  const digest = sha256(canonicalOps(ops))
  const cached = db.budgetAnalyses.findOne({ userId, year, month })

  if (!force && cached && cached.opsDigest === digest) {
    return { analysis: cached.response, cachedAt: cached.updatedAt,
             opsDigest: digest, stale: false }
  }

  const payload  = buildPayload({ ops, history, cats, recurr, year, month })
  const response = await callAnthropic(payload)
  validate(response, { categoryIdsAllowed: cats.map((c) => c._id) })

  db.budgetAnalyses.upsert({ userId, year, month, opsDigest: digest,
                             response, model: ANTHROPIC_MODEL })
  return { analysis: response, cachedAt: now(), opsDigest: digest, stale: false }
}
```

`canonicalOps(ops)` produit une chaîne déterministe : ops triées par `(date, _id)`, format `${date}|${amount}|${categoryId ?? "-"}|${label}` joint par `\n`. SHA-256 sur le résultat.

### Configuration Anthropic

- SDK officiel `@anthropic-ai/sdk`.
- Modèle : `ANTHROPIC_MODEL = 'claude-sonnet-4-6'`, exporté depuis `prompts/budgetAnalysisPrompt.js` (constante en dur, bump manuel).
- Timeout : 60 s, `maxRetries: 2` (gestion native SDK).
- `cache_control: { type: "ephemeral" }` sur le system prompt et la définition d'outil.
- Vérification de la skill `claude-api` au moment de l'implémentation pour la version exacte du SDK et le format `messages.create` 2026.

### Rate-limit

```js
// middleware/rateLimitAnalysis.js
rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user.id,
  message: { message: "Trop d'analyses cette heure. Réessayez plus tard." },
  standardHeaders: true,
})
```

Appliqué uniquement à `POST /api/budget-analyses` (pas au GET, pas à `apply-suggestion`).

### Surface routeur

```js
router.get ('/',                  asyncHandler(getAnalysis))
router.post('/',                  rateLimitAnalysis, asyncHandler(runAnalysis))
router.post('/apply-suggestion',  asyncHandler(applySuggestion))
```

`requireAuth` monté au niveau `app.use(...)` dans `app.js`.

### Gestion d'erreurs

| Cas                                              | Status | Comportement                                                       |
|--------------------------------------------------|-------:|--------------------------------------------------------------------|
| `year`/`month` invalides                         |    400 | message clair                                                      |
| `ANTHROPIC_API_KEY` manquante                    |    503 | "Service IA non configuré" + `console.warn` au boot                |
| Anthropic 429/5xx                                |    502 | "Service IA indisponible, réessayez", **pas** de cache écrit       |
| Anthropic timeout (> 60 s)                       |    504 | idem                                                               |
| Réponse Claude ne valide pas le schéma           |    502 | log les `categoryId` fautifs, message générique au client          |
| `apply-suggestion` sur categoryId d'un autre user |   404 | jamais 403 (pas de leak)                                           |

## Sécurité

- `ANTHROPIC_API_KEY` : `server/.env` uniquement, jamais exposée au client.
- Aucun libellé d'opération ni identifiant bancaire dans le payload envoyé à Claude.
- Tous les accès passent par `requireAuth` ; le repo scope toujours par `userId`.
- `apply-suggestion` re-vérifie l'appartenance de la catégorie avant `update`.
- Pas de log de la réponse Claude complète en prod (chiffres financiers). En cas d'échec de validation, on log uniquement les `categoryId` fautifs.

## Tests

### Tests serveur (vitest)

- `vi.mock('@anthropic-ai/sdk')` → mock une réponse `tool_use` valide.
- Digest stable pour un même set d'opérations.
- Cache hit/miss selon le digest.
- Validation d'erreurs : `categoryId` inconnu, severity hors enum, champs manquants.
- Routes : auth, rate-limit (11e POST → 429), GET sans cache → 404, POST puis GET → `stale: false`, mutation d'op → GET → `stale: true`.
- `apply-suggestion` : update OK, cross-user → 404, `suggestedBudget < Σ récurrentes` → 400.

### Tests E2E (Playwright, `e2e/specs/budget-analysis.spec.js`)

Mock Anthropic via variable d'env `MOCK_ANTHROPIC=1` lue dans `budgetAnalysisService` — pas de plomberie en plus, pas de tokens consommés en CI.

Scénarios :

1. Mois sans opération → `EmptyState`, bouton désactivé.
2. Mois avec opérations → clic "Analyser" → loading → sections + donut + suggestions rendues.
3. Clic "Appliquer" sur une suggestion → toast OK, ligne grisée, `/categories` montre le nouveau `maxAmount`.
4. Modifier une op du mois → retour sur `/analysis` → bandeau `stale`.
5. Clic "Régénérer" → nouvelle analyse rendue (le mock change la `summary`).
6. 11 POST consécutifs → 429 affiché proprement.

### Validation UI (skill `webapp-testing`, avant commit)

`yarn dev` racine, puis via `mcp__playwright__*` :
- Naviguer sur `/analysis`, lancer une analyse avec `MOCK_ANTHROPIC=1`.
- Vérifier zéro erreur console.
- Screenshot du résultat (synthèse + suggestions + donut).

## Roll-out

- **Pas de feature flag.** La feature est gated par l'absence de `ANTHROPIC_API_KEY` : 503 propre côté UI, message d'erreur clair.
- Pas de migration de données existantes ; la table nouvelle est vide au boot.
- Pas de breaking change sur l'API existante.
- Ajout de `ANTHROPIC_API_KEY` à la section "Environment" du `CLAUDE.md` racine.

## Hors-scope (volontairement)

- Pas de streaming de la réponse Claude.
- Pas d'historique des analyses (1 ligne par mois, on écrase).
- Pas d'export PDF/markdown de l'analyse.
- Pas de fusion avec `useMonthlyInsights` (les heuristiques locales restent en place sur `HomePage`).
- Pas d'i18n (app française, system prompt force le français).
- Pas de partage d'analyse entre utilisateurs.

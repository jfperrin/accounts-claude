# Analyse budgétaire par Claude — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page `/analysis` qui envoie les opérations catégorisées du mois sélectionné à Claude via l'API Anthropic (côté serveur uniquement) et affiche une analyse structurée avec corrections de budget appliquables.

**Architecture:** Page React `BudgetAnalysisPage` + 3 routes Express (`/api/budget-analyses` GET/POST + `/apply-suggestion`). Le serveur appelle Anthropic avec `tool_choice` forcé et cache la réponse en DB par `(userId, year, month)` avec invalidation par digest SHA-256 des opérations. Pas d'appel auto, bouton manuel + rate-limit 10/h/user.

**Tech Stack:** `@anthropic-ai/sdk` v0.30+, Express 5, better-sqlite3, Mongoose, React 18, recharts, shadcn/ui.

**Référence spec :** [docs/superpowers/specs/2026-06-04-claude-budget-analysis-design.md](../specs/2026-06-04-claude-budget-analysis-design.md)

---

## Phase A — Fondations serveur

### Task A.1 : Installer le SDK Anthropic et variables d'environnement

**Files:**
- Modify: `server/package.json`
- Modify: `server/.env.example` (créer si absent)
- Modify: `CLAUDE.md` (section Environment)

- [ ] **Step 1 : Installer le SDK**

```bash
yarn --cwd server add @anthropic-ai/sdk
```

Vérifier que `server/package.json` contient `"@anthropic-ai/sdk": "^0.x.y"` dans `dependencies`.

- [ ] **Step 2 : Ajouter les variables d'env**

Vérifier `server/.env.example` (le créer si absent) et y ajouter :

```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
MOCK_ANTHROPIC=
```

- [ ] **Step 3 : Documenter dans CLAUDE.md racine**

Ajouter à la liste env de `CLAUDE.md` racine (section `server/.env (gitignored)`) :

```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
MOCK_ANTHROPIC=                              # 1 en test E2E pour bypass de l'appel réseau
```

- [ ] **Step 4 : Commit**

```bash
git add server/package.json server/yarn.lock server/.env.example CLAUDE.md
git commit -m "deps: add @anthropic-ai/sdk for budget analysis"
```

---

### Task A.2 : Migration SQLite (table `budget_analyses`)

**Files:**
- Modify: `server/db/sqlite.js` (bloc `initSchema` + nouveau repo `budgetAnalyses`)

- [ ] **Step 1 : Écrire le test du repo**

Créer `server/tests/budgetAnalysesRepo.test.js` :

```js
const { describe, it, expect, beforeEach, afterEach } = require('vitest');
const path = require('path');
const fs = require('fs');
const os = require('os');

let db; let tmpFile;

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `ba-${Date.now()}-${Math.random()}.db`);
  process.env.SQLITE_PATH = tmpFile;
  delete require.cache[require.resolve('../db/sqlite')];
  const create = require('../db/sqlite');
  db = create();
  // seed un user pour respecter la FK
  db.users.create({ email: 'a@b.c', passwordHash: 'x' });
});
afterEach(() => {
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

describe('budgetAnalyses repo (SQLite)', () => {
  it('upsert + findOne renvoient la même donnée', async () => {
    const user = (await db.users.findByEmail('a@b.c'));
    const data = { userId: user._id, year: 2026, month: 6,
      opsDigest: 'abc', response: { summary: 'ok' }, model: 'claude-sonnet-4-6' };
    db.budgetAnalyses.upsert(data);
    const row = db.budgetAnalyses.findOne({ userId: user._id, year: 2026, month: 6 });
    expect(row.opsDigest).toBe('abc');
    expect(row.response.summary).toBe('ok');
    expect(row.model).toBe('claude-sonnet-4-6');
    expect(row.updatedAt).toBeTruthy();
  });

  it('upsert remplace une ligne existante', () => {
    const user = db.users.findByEmail('a@b.c');
    db.budgetAnalyses.upsert({ userId: user._id, year: 2026, month: 6,
      opsDigest: 'v1', response: { s: 1 }, model: 'm' });
    db.budgetAnalyses.upsert({ userId: user._id, year: 2026, month: 6,
      opsDigest: 'v2', response: { s: 2 }, model: 'm' });
    const row = db.budgetAnalyses.findOne({ userId: user._id, year: 2026, month: 6 });
    expect(row.opsDigest).toBe('v2');
    expect(row.response.s).toBe(2);
  });

  it('findOne retourne null si absent', () => {
    const user = db.users.findByEmail('a@b.c');
    expect(db.budgetAnalyses.findOne({ userId: user._id, year: 2025, month: 1 })).toBeNull();
  });
});
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
yarn --cwd server test budgetAnalysesRepo
```

Attendu : `TypeError: Cannot read properties of undefined (reading 'upsert')` (le repo n'existe pas).

- [ ] **Step 3 : Ajouter la table dans `initSchema`**

Dans `server/db/sqlite.js`, à la fin du bloc `db.exec(\`...\`)` de `initSchema`, juste avant la fermeture du backtick, ajouter :

```sql
CREATE TABLE IF NOT EXISTS budget_analyses (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL,
  ops_digest  TEXT NOT NULL,
  response    TEXT NOT NULL,         -- JSON stringifié
  model       TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, year, month)
);
```

- [ ] **Step 4 : Implémenter le repo `budgetAnalyses`**

Dans `server/db/sqlite.js`, **avant** le `return { users, banks, ... }` final, ajouter :

```js
const budgetAnalyses = {
  findOne({ userId, year, month }) {
    const row = db.prepare(
      'SELECT * FROM budget_analyses WHERE user_id = ? AND year = ? AND month = ?',
    ).get(uid(userId), year, month);
    if (!row) return null;
    return {
      _id: row.id,
      userId: row.user_id,
      year: row.year,
      month: row.month,
      opsDigest: row.ops_digest,
      response: JSON.parse(row.response),
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  upsert({ userId, year, month, opsDigest, response, model }) {
    const id = randomUUID();
    db.prepare(
      `INSERT INTO budget_analyses (id, user_id, year, month, ops_digest, response, model)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, year, month) DO UPDATE SET
         ops_digest = excluded.ops_digest,
         response   = excluded.response,
         model      = excluded.model,
         updated_at = datetime('now')`,
    ).run(id, uid(userId), year, month, opsDigest, JSON.stringify(response), model);
  },
};
```

Puis ajouter `budgetAnalyses` à l'objet retourné :

```js
return {
  users, banks, operations, recurringOps, resetTokens,
  categories, categoryHints, dismissedRecurringSuggestions, mfaCodes, refreshTokens,
  budgetAnalyses,
};
```

- [ ] **Step 5 : Vérifier les tests**

```bash
yarn --cwd server test budgetAnalysesRepo
```

Attendu : 3 tests passent.

- [ ] **Step 6 : Lint + commit**

```bash
yarn --cwd server lint
git add server/db/sqlite.js server/tests/budgetAnalysesRepo.test.js
git commit -m "feat(server): add budget_analyses table and SQLite repo"
```

---

### Task A.3 : Repo Mongoose (équivalent Mongo)

**Files:**
- Modify: `server/db/mongo.js`

- [ ] **Step 1 : Repérer la structure du fichier**

Ouvrir `server/db/mongo.js` et identifier :
- la zone où sont définis les `Schema` Mongoose
- la zone où sont exportés les repos (un objet `{ users, banks, ... }`)

- [ ] **Step 2 : Ajouter le schéma**

Dans la section des Schemas, ajouter :

```js
const budgetAnalysisSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  year:      { type: Number, required: true },
  month:     { type: Number, required: true },
  opsDigest: { type: String, required: true },
  response:  { type: mongoose.Schema.Types.Mixed, required: true },
  model:     { type: String, required: true },
}, { timestamps: true });

budgetAnalysisSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const BudgetAnalysis = mongoose.models.BudgetAnalysis
  || mongoose.model('BudgetAnalysis', budgetAnalysisSchema);
```

- [ ] **Step 3 : Ajouter le repo**

Dans la section des repos (avant le `return {...}` final), ajouter :

```js
const budgetAnalyses = {
  async findOne({ userId, year, month }) {
    const doc = await BudgetAnalysis.findOne({ userId, year, month }).lean();
    if (!doc) return null;
    return {
      _id: String(doc._id),
      userId: String(doc.userId),
      year: doc.year,
      month: doc.month,
      opsDigest: doc.opsDigest,
      response: doc.response,
      model: doc.model,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  },

  async upsert({ userId, year, month, opsDigest, response, model }) {
    await BudgetAnalysis.updateOne(
      { userId, year, month },
      { $set: { opsDigest, response, model } },
      { upsert: true },
    );
  },
};
```

Puis ajouter `budgetAnalyses` à l'objet `return {...}`.

- [ ] **Step 4 : Vérifier la suppression cascade**

Chercher dans `mongo.js` la fonction qui supprime un user (ex: `users.delete` ou `users.deleteOne`). Vérifier qu'elle supprime aussi les `BudgetAnalysis` du user. Si non, ajouter avant la suppression du user :

```js
await BudgetAnalysis.deleteMany({ userId: id });
```

- [ ] **Step 5 : Lint + commit**

```bash
yarn --cwd server lint
git add server/db/mongo.js
git commit -m "feat(server): add BudgetAnalysis Mongoose schema and repo"
```

---

## Phase B — Helpers purs (TDD)

### Task B.1 : `canonicalOps` + `digestOps`

**Files:**
- Create: `server/services/budgetAnalysis/digest.js`
- Test: `server/tests/budgetAnalysisDigest.test.js`

- [ ] **Step 1 : Écrire les tests**

Créer `server/tests/budgetAnalysisDigest.test.js` :

```js
const { describe, it, expect } = require('vitest');
const { canonicalOps, digestOps } = require('../services/budgetAnalysis/digest');

const baseOp = (over = {}) => ({
  _id: '1', date: '2026-06-03T12:00:00.000Z',
  amount: -42.5, categoryId: 'c1', label: 'Foo', ...over,
});

describe('canonicalOps', () => {
  it('produit une chaîne stable indépendante de l\'ordre d\'entrée', () => {
    const a = [baseOp({ _id: '1' }), baseOp({ _id: '2', amount: 10 })];
    const b = [baseOp({ _id: '2', amount: 10 }), baseOp({ _id: '1' })];
    expect(canonicalOps(a)).toEqual(canonicalOps(b));
  });

  it('inclut la catégorie null sous forme "-"', () => {
    const r = canonicalOps([baseOp({ categoryId: null })]);
    expect(r).toContain('|-|');
  });
});

describe('digestOps', () => {
  it('retourne un hex de 64 caractères (SHA-256)', () => {
    expect(digestOps([baseOp()])).toMatch(/^[a-f0-9]{64}$/);
  });

  it('change quand un montant change', () => {
    const a = digestOps([baseOp({ amount: -42 })]);
    const b = digestOps([baseOp({ amount: -43 })]);
    expect(a).not.toBe(b);
  });

  it('reste identique pour un ordre d\'entrée permuté', () => {
    const a = digestOps([baseOp({ _id: '1' }), baseOp({ _id: '2', amount: 5 })]);
    const b = digestOps([baseOp({ _id: '2', amount: 5 }), baseOp({ _id: '1' })]);
    expect(a).toBe(b);
  });

  it('digest d\'un tableau vide est constant', () => {
    expect(digestOps([])).toBe(digestOps([]));
  });
});
```

- [ ] **Step 2 : Run tests, voir l'échec**

```bash
yarn --cwd server test budgetAnalysisDigest
```

Attendu : `Cannot find module`.

- [ ] **Step 3 : Implémenter `digest.js`**

Créer `server/services/budgetAnalysis/digest.js` :

```js
const { createHash } = require('crypto');

// Forme canonique pour le hash : tri par (date, _id), join '|', séparé par '\n'.
// L'inclusion du label garantit qu'un rename de récurrente invalide le cache,
// même si date/amount/categoryId restent identiques.
function canonicalOps(ops) {
  const sorted = [...ops].sort((a, b) => {
    const cmp = String(a.date).localeCompare(String(b.date));
    if (cmp !== 0) return cmp;
    return String(a._id ?? '').localeCompare(String(b._id ?? ''));
  });
  return sorted
    .map((o) => [
      o.date,
      Number(o.amount).toFixed(2),
      o.categoryId ?? '-',
      o.label ?? '',
    ].join('|'))
    .join('\n');
}

function digestOps(ops) {
  return createHash('sha256').update(canonicalOps(ops)).digest('hex');
}

module.exports = { canonicalOps, digestOps };
```

- [ ] **Step 4 : Run tests pour voir vert**

```bash
yarn --cwd server test budgetAnalysisDigest
```

Attendu : 5 tests passent.

- [ ] **Step 5 : Lint + commit**

```bash
yarn --cwd server lint
git add server/services/budgetAnalysis/digest.js server/tests/budgetAnalysisDigest.test.js
git commit -m "feat(server): add deterministic ops digest for budget analysis cache"
```

---

### Task B.2 : `buildPayload`

**Files:**
- Create: `server/services/budgetAnalysis/payload.js`
- Test: `server/tests/budgetAnalysisPayload.test.js`

- [ ] **Step 1 : Écrire les tests**

Créer `server/tests/budgetAnalysisPayload.test.js` :

```js
const { describe, it, expect } = require('vitest');
const { buildPayload } = require('../services/budgetAnalysis/payload');

const cats = [
  { _id: 'c1', label: 'Courses', kind: 'debit',  maxAmount: 200 },
  { _id: 'c2', label: 'Salaire', kind: 'credit', maxAmount: null },
];
const recurring = [
  { _id: 'r1', label: 'Loyer', amount: -800, categoryId: 'c1', bankId: 'b1', dayOfMonth: 5 },
];
const ops = [
  { _id: 'o1', date: '2026-06-03T00:00:00.000Z', amount: -42.5, categoryId: 'c1', label: 'X' },
  { _id: 'o2', date: '2026-06-10T00:00:00.000Z', amount: 1500,  categoryId: 'c2', label: 'Y' },
];
const history = [
  { _id: 'h1', date: '2026-05-15T00:00:00.000Z', amount: -100, categoryId: 'c1', label: 'A' },
  { _id: 'h2', date: '2026-04-01T00:00:00.000Z', amount: -50,  categoryId: 'c1', label: 'B' },
];

describe('buildPayload', () => {
  const payload = buildPayload({
    year: 2026, month: 6, categories: cats, recurring, currentMonthOps: ops, historyOps: history,
  });

  it('produit le bon mois', () => {
    expect(payload.month).toBe('2026-06');
    expect(payload.currency).toBe('EUR');
  });

  it('expose les catégories avec leur budget mensuel = maxAmount + Σ récurrentes', () => {
    const courses = payload.categories.find((c) => c.id === 'c1');
    expect(courses.monthlyBudget).toBe(1000); // 200 + 800
    expect(courses.kind).toBe('debit');
  });

  it('budget = 0 si pas de maxAmount ni de récurrentes', () => {
    const salaire = payload.categories.find((c) => c.id === 'c2');
    expect(salaire.monthlyBudget).toBe(0);
  });

  it('ops du mois sans label, sans bankId, sans _id', () => {
    const op = payload.currentMonth.operations[0];
    expect(op).toEqual({ date: '2026-06-03', amount: -42.5, categoryId: 'c1' });
    expect(op).not.toHaveProperty('label');
    expect(op).not.toHaveProperty('_id');
  });

  it('history regroupe les ops par mois et catégorie', () => {
    expect(payload.history).toHaveLength(6);
    const may = payload.history.find((m) => m.month === '2026-05');
    const c1May = may.byCategory.find((c) => c.categoryId === 'c1');
    expect(c1May.totalDebit).toBe(100);
    expect(c1May.opsCount).toBe(1);
  });
});
```

- [ ] **Step 2 : Run tests, voir échec**

```bash
yarn --cwd server test budgetAnalysisPayload
```

Attendu : module manquant.

- [ ] **Step 3 : Implémenter `payload.js`**

Créer `server/services/budgetAnalysis/payload.js` :

```js
// Construit le payload anonymisé envoyé à Claude.
// Pas de label d'op, pas de bankId — seulement date/amount/categoryId.
function buildPayload({ year, month, categories, recurring, currentMonthOps, historyOps }) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const recByCat = new Map();
  for (const r of recurring) {
    const cid = String(r.categoryId?._id ?? r.categoryId ?? '');
    if (!cid) continue;
    recByCat.set(cid, (recByCat.get(cid) ?? 0) + Math.abs(Number(r.amount) || 0));
  }

  const payloadCats = categories.map((c) => {
    const id = String(c._id);
    const recSum = recByCat.get(id) ?? 0;
    const max = Number(c.maxAmount ?? 0);
    return {
      id,
      label: c.label,
      kind: c.kind ?? 'debit',
      monthlyBudget: Math.round((recSum + max) * 100) / 100,
      isAuto: !!c.isAuto,
    };
  });

  const operations = currentMonthOps.map((o) => ({
    date: String(o.date).slice(0, 10),
    amount: Number(o.amount),
    categoryId: o.categoryId ? String(o.categoryId?._id ?? o.categoryId) : null,
  }));

  // Bucket historique en 6 mois N-1..N-6.
  const buckets = new Map();
  for (let i = 1; i <= 6; i += 1) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    buckets.set(`${y}-${String(m).padStart(2, '0')}`, new Map());
  }
  for (const o of historyOps) {
    const key = String(o.date).slice(0, 7);
    const byCat = buckets.get(key);
    if (!byCat) continue;
    const cid = String(o.categoryId?._id ?? o.categoryId ?? '-');
    const slot = byCat.get(cid) ?? { totalDebit: 0, totalCredit: 0, opsCount: 0 };
    const amt = Number(o.amount);
    if (amt < 0) slot.totalDebit  += -amt;
    else         slot.totalCredit += amt;
    slot.opsCount += 1;
    byCat.set(cid, slot);
  }
  const history = [...buckets.entries()].map(([mk, byCat]) => ({
    month: mk,
    byCategory: [...byCat.entries()].map(([cid, agg]) => ({
      categoryId: cid,
      totalDebit:  Math.round(agg.totalDebit  * 100) / 100,
      totalCredit: Math.round(agg.totalCredit * 100) / 100,
      opsCount: agg.opsCount,
    })),
  }));

  return {
    month: monthStr,
    currency: 'EUR',
    categories: payloadCats,
    currentMonth: { operations },
    history,
  };
}

module.exports = { buildPayload };
```

- [ ] **Step 4 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysisPayload
yarn --cwd server lint
git add server/services/budgetAnalysis/payload.js server/tests/budgetAnalysisPayload.test.js
git commit -m "feat(server): build anonymized payload for Claude budget analysis"
```

---

### Task B.3 : `validateResponse`

**Files:**
- Create: `server/services/budgetAnalysis/validate.js`
- Test: `server/tests/budgetAnalysisValidate.test.js`

- [ ] **Step 1 : Tests**

Créer `server/tests/budgetAnalysisValidate.test.js` :

```js
const { describe, it, expect } = require('vitest');
const { validateResponse } = require('../services/budgetAnalysis/validate');

const valid = {
  summary: 'Résumé.',
  highlights: [{ title: 't', detail: 'd', severity: 'info' }],
  anomalies:  [{ title: 't', detail: 'd', categoryId: 'c1' }],
  trends:     [{ categoryId: 'c1', direction: 'up', magnitudePct: 10, comment: 'c' }],
  budgetSuggestions: [{ categoryId: 'c1', currentBudget: 100, suggestedBudget: 150, rationale: 'r' }],
  categoryBreakdown: [{ categoryId: 'c1', share: 0.5, amount: 200 }],
};
const allowed = new Set(['c1', 'c2']);

describe('validateResponse', () => {
  it('accepte une réponse valide', () => {
    expect(() => validateResponse(valid, allowed)).not.toThrow();
  });

  it('rejette une severity hors enum', () => {
    const bad = { ...valid, highlights: [{ title: 't', detail: 'd', severity: 'pink' }] };
    expect(() => validateResponse(bad, allowed)).toThrow(/severity/);
  });

  it('rejette un categoryId inconnu', () => {
    const bad = { ...valid, trends: [{ ...valid.trends[0], categoryId: 'cZZ' }] };
    expect(() => validateResponse(bad, allowed)).toThrow(/categoryId/);
  });

  it('rejette quand summary manque', () => {
    const bad = { ...valid }; delete bad.summary;
    expect(() => validateResponse(bad, allowed)).toThrow(/summary/);
  });

  it('accepte categoryId:null dans anomalies', () => {
    const ok = { ...valid, anomalies: [{ title: 't', detail: 'd', categoryId: null }] };
    expect(() => validateResponse(ok, allowed)).not.toThrow();
  });

  it('rejette un share hors [0,1]', () => {
    const bad = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1.5, amount: 1 }] };
    expect(() => validateResponse(bad, allowed)).toThrow(/share/);
  });
});
```

- [ ] **Step 2 : Run, voir échec**

```bash
yarn --cwd server test budgetAnalysisValidate
```

- [ ] **Step 3 : Implémenter `validate.js`**

Créer `server/services/budgetAnalysis/validate.js` :

```js
const SEVERITIES = new Set(['info', 'positive', 'warning', 'critical']);
const DIRECTIONS = new Set(['up', 'down', 'stable']);

class BudgetAnalysisValidationError extends Error {
  constructor(msg) { super(msg); this.name = 'BudgetAnalysisValidationError'; }
}
const fail = (m) => { throw new BudgetAnalysisValidationError(m); };

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function checkCatId(id, allowed, path, allowNull = false) {
  if (id === null) { if (allowNull) return; fail(`${path}: categoryId null non autorisé`); }
  if (!isStr(id)) fail(`${path}: categoryId requis`);
  if (!allowed.has(id)) fail(`${path}: categoryId inconnu (${id})`);
}

function validateResponse(r, allowedCatIds) {
  if (!r || typeof r !== 'object') fail('réponse: objet attendu');
  if (!isStr(r.summary)) fail('summary: string non vide requise');

  if (!Array.isArray(r.highlights)) fail('highlights: array attendue');
  r.highlights.forEach((h, i) => {
    if (!isStr(h.title))  fail(`highlights[${i}].title`);
    if (!isStr(h.detail)) fail(`highlights[${i}].detail`);
    if (!SEVERITIES.has(h.severity)) fail(`highlights[${i}].severity invalide`);
  });

  if (!Array.isArray(r.anomalies)) fail('anomalies: array attendue');
  r.anomalies.forEach((a, i) => {
    if (!isStr(a.title))  fail(`anomalies[${i}].title`);
    if (!isStr(a.detail)) fail(`anomalies[${i}].detail`);
    checkCatId(a.categoryId, allowedCatIds, `anomalies[${i}]`, true);
  });

  if (!Array.isArray(r.trends)) fail('trends: array attendue');
  r.trends.forEach((t, i) => {
    checkCatId(t.categoryId, allowedCatIds, `trends[${i}]`);
    if (!DIRECTIONS.has(t.direction)) fail(`trends[${i}].direction invalide`);
    if (!isNum(t.magnitudePct)) fail(`trends[${i}].magnitudePct`);
    if (!isStr(t.comment)) fail(`trends[${i}].comment`);
  });

  if (!Array.isArray(r.budgetSuggestions)) fail('budgetSuggestions: array attendue');
  r.budgetSuggestions.forEach((s, i) => {
    checkCatId(s.categoryId, allowedCatIds, `budgetSuggestions[${i}]`);
    if (!isNum(s.currentBudget))   fail(`budgetSuggestions[${i}].currentBudget`);
    if (!isNum(s.suggestedBudget) || s.suggestedBudget < 0)
      fail(`budgetSuggestions[${i}].suggestedBudget`);
    if (!isStr(s.rationale)) fail(`budgetSuggestions[${i}].rationale`);
  });

  if (!Array.isArray(r.categoryBreakdown)) fail('categoryBreakdown: array attendue');
  r.categoryBreakdown.forEach((b, i) => {
    checkCatId(b.categoryId, allowedCatIds, `categoryBreakdown[${i}]`);
    if (!isNum(b.share) || b.share < 0 || b.share > 1)
      fail(`categoryBreakdown[${i}].share hors [0,1]`);
    if (!isNum(b.amount)) fail(`categoryBreakdown[${i}].amount`);
  });
}

module.exports = { validateResponse, BudgetAnalysisValidationError };
```

- [ ] **Step 4 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysisValidate
yarn --cwd server lint
git add server/services/budgetAnalysis/validate.js server/tests/budgetAnalysisValidate.test.js
git commit -m "feat(server): strict schema validation for Claude budget analysis response"
```

---

## Phase C — Intégration Anthropic

### Task C.1 : Prompt système + schéma d'outil

**Files:**
- Create: `server/services/budgetAnalysis/prompt.js`

- [ ] **Step 1 : Écrire le module**

Créer `server/services/budgetAnalysis/prompt.js` :

```js
const ANTHROPIC_MODEL_DEFAULT = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `Tu es un assistant d'analyse budgétaire personnel.
Tu reçois en entrée des opérations bancaires anonymisées (dates, montants, identifiants de catégories) ainsi que des agrégats par catégorie sur les 6 mois précédents.

Ta mission :
1. Synthétiser le mois courant en 200 mots maximum, ton neutre, en français.
2. Identifier les points marquants (highlights) avec une sévérité : "info", "positive", "warning", "critical".
3. Détecter les anomalies vraisemblables (montants exceptionnels, dérapages, manques).
4. Quantifier les tendances par catégorie sur l'historique (up/down/stable, %).
5. Proposer des corrections de budget par catégorie quand le réel diverge significativement du prévu sur l'historique.
6. Fournir une répartition des dépenses du mois courant par catégorie (share entre 0 et 1, amount en €).

Contraintes strictes :
- Réponds UNIQUEMENT en appelant l'outil submit_budget_analysis. Aucun texte hors de l'outil.
- N'invente pas de catégorie : utilise UNIQUEMENT les categoryId fournis dans le payload.
- Les montants sont en euros, format nombre (pas de string).
- N'inclus pas de PII (le payload n'en contient pas, n'en invente pas).`;

const TOOL_SCHEMA = {
  name: 'submit_budget_analysis',
  description: "Soumet l'analyse budgétaire mensuelle structurée.",
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'highlights', 'anomalies', 'trends', 'budgetSuggestions', 'categoryBreakdown'],
    properties: {
      summary: { type: 'string', maxLength: 2000 },
      highlights: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'detail', 'severity'],
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            severity: { type: 'string', enum: ['info', 'positive', 'warning', 'critical'] },
          },
        },
      },
      anomalies: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'detail', 'categoryId'],
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            categoryId: { type: ['string', 'null'] },
          },
        },
      },
      trends: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'direction', 'magnitudePct', 'comment'],
          properties: {
            categoryId: { type: 'string' },
            direction: { type: 'string', enum: ['up', 'down', 'stable'] },
            magnitudePct: { type: 'number' },
            comment: { type: 'string' },
          },
        },
      },
      budgetSuggestions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'currentBudget', 'suggestedBudget', 'rationale'],
          properties: {
            categoryId: { type: 'string' },
            currentBudget: { type: 'number' },
            suggestedBudget: { type: 'number', minimum: 0 },
            rationale: { type: 'string' },
          },
        },
      },
      categoryBreakdown: {
        type: 'array',
        items: {
          type: 'object',
          required: ['categoryId', 'share', 'amount'],
          properties: {
            categoryId: { type: 'string' },
            share: { type: 'number', minimum: 0, maximum: 1 },
            amount: { type: 'number' },
          },
        },
      },
    },
  },
};

module.exports = { ANTHROPIC_MODEL_DEFAULT, SYSTEM_PROMPT, TOOL_SCHEMA };
```

- [ ] **Step 2 : Lint + commit**

```bash
yarn --cwd server lint
git add server/services/budgetAnalysis/prompt.js
git commit -m "feat(server): system prompt and tool schema for budget analysis"
```

---

### Task C.2 : `callAnthropic` + bypass via `MOCK_ANTHROPIC`

**Files:**
- Create: `server/services/budgetAnalysis/anthropic.js`
- Test: `server/tests/budgetAnalysisAnthropic.test.js`

- [ ] **Step 1 : AVANT D'ÉCRIRE LE CODE : invoquer la skill `claude-api`**

L'agent qui implémente cette tâche DOIT lire la skill `claude-api` via :

```
Skill claude-api
```

Pour confirmer :
- la version actuelle du SDK `@anthropic-ai/sdk`
- le format exact de `messages.create` en 2026
- où placer `cache_control` (sur le system prompt, sur le tool définition)
- la lecture du `tool_use` dans la réponse

Le code ci-dessous suit le pattern de l'époque T0 ; à ajuster si la skill indique une différence.

- [ ] **Step 2 : Test**

Créer `server/tests/budgetAnalysisAnthropic.test.js` :

```js
const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');

let originalKey, originalMock;
beforeEach(() => {
  originalKey  = process.env.ANTHROPIC_API_KEY;
  originalMock = process.env.MOCK_ANTHROPIC;
});
afterEach(() => {
  process.env.ANTHROPIC_API_KEY = originalKey;
  process.env.MOCK_ANTHROPIC    = originalMock;
  vi.resetModules();
});

describe('callAnthropic — mock mode', () => {
  it('retourne une réponse fixe quand MOCK_ANTHROPIC=1', async () => {
    process.env.MOCK_ANTHROPIC = '1';
    const { callAnthropic } = require('../services/budgetAnalysis/anthropic');
    const out = await callAnthropic({ payload: { month: '2026-06' }, allowedCatIds: new Set(['c1']) });
    expect(out.summary).toBeTruthy();
    expect(Array.isArray(out.budgetSuggestions)).toBe(true);
  });

  it('lance 503 si ANTHROPIC_API_KEY absente hors mock', async () => {
    delete process.env.MOCK_ANTHROPIC;
    delete process.env.ANTHROPIC_API_KEY;
    const { callAnthropic } = require('../services/budgetAnalysis/anthropic');
    await expect(callAnthropic({ payload: {}, allowedCatIds: new Set() }))
      .rejects.toMatchObject({ status: 503 });
  });
});
```

- [ ] **Step 3 : Run, voir échec**

```bash
yarn --cwd server test budgetAnalysisAnthropic
```

- [ ] **Step 4 : Implémenter `anthropic.js`**

Créer `server/services/budgetAnalysis/anthropic.js` :

```js
const { SYSTEM_PROMPT, TOOL_SCHEMA, ANTHROPIC_MODEL_DEFAULT } = require('./prompt');

class AnthropicError extends Error {
  constructor(msg, status) { super(msg); this.status = status; this.name = 'AnthropicError'; }
}

// Réponse fixe utilisée en E2E et en tests pour ne pas appeler le réseau.
// Conforme au schéma — utilise les premiers categoryId fournis.
function mockResponse(allowedCatIds) {
  const ids = [...allowedCatIds];
  const c1 = ids[0] ?? 'cat_mock';
  return {
    summary: 'Analyse simulée (MOCK_ANTHROPIC). Pas d\'appel réseau.',
    highlights: [{ title: 'Mock', detail: 'Réponse de test', severity: 'info' }],
    anomalies: [],
    trends: ids.length > 0
      ? [{ categoryId: c1, direction: 'stable', magnitudePct: 0, comment: 'mock' }]
      : [],
    budgetSuggestions: ids.length > 0
      ? [{ categoryId: c1, currentBudget: 100, suggestedBudget: 120, rationale: 'mock' }]
      : [],
    categoryBreakdown: ids.length > 0
      ? [{ categoryId: c1, share: 1, amount: 100 }]
      : [],
  };
}

async function callAnthropic({ payload, allowedCatIds }) {
  if (process.env.MOCK_ANTHROPIC === '1') {
    return mockResponse(allowedCatIds);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AnthropicError('ANTHROPIC_API_KEY manquante', 503);
  }

  // Import lazy pour éviter de charger le SDK en mode mock / hors prod.
  // eslint-disable-next-line global-require
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default
    ? new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })
    : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const model = process.env.ANTHROPIC_MODEL || ANTHROPIC_MODEL_DEFAULT;

  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: 4096,
      // cache_control : système stable ⇒ ephemeral. Économise ~80 % des tokens
      // d'entrée sur des appels rapprochés du même user.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: [{ ...TOOL_SCHEMA, cache_control: { type: 'ephemeral' } }],
      tool_choice: { type: 'tool', name: 'submit_budget_analysis' },
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
    });
  } catch (e) {
    const code = e?.status ?? e?.response?.status;
    if (code && code >= 400 && code < 600) {
      throw new AnthropicError(`Anthropic ${code}`, code === 429 ? 502 : 502);
    }
    throw new AnthropicError(`Anthropic erreur: ${e.message}`, 502);
  }

  const block = (resp.content || []).find((c) => c.type === 'tool_use');
  if (!block || !block.input) {
    throw new AnthropicError('Réponse Anthropic sans tool_use', 502);
  }
  return block.input;
}

module.exports = { callAnthropic, AnthropicError };
```

- [ ] **Step 5 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysisAnthropic
yarn --cwd server lint
git add server/services/budgetAnalysis/anthropic.js server/tests/budgetAnalysisAnthropic.test.js
git commit -m "feat(server): Anthropic SDK wrapper with mock and prompt caching"
```

---

## Phase D — Orchestrateur

### Task D.1 : `getOrCompute`

**Files:**
- Create: `server/services/budgetAnalysisService.js`
- Test: `server/tests/budgetAnalysisService.test.js`

- [ ] **Step 1 : Test**

Créer `server/tests/budgetAnalysisService.test.js` :

```js
const { describe, it, expect, vi, beforeEach } = require('vitest');

vi.mock('../services/budgetAnalysis/anthropic', () => ({
  callAnthropic: vi.fn(async ({ allowedCatIds }) => ({
    summary: 'live',
    highlights: [], anomalies: [], trends: [],
    budgetSuggestions: [{
      categoryId: [...allowedCatIds][0], currentBudget: 100, suggestedBudget: 150, rationale: 'r',
    }],
    categoryBreakdown: [{ categoryId: [...allowedCatIds][0], share: 1, amount: 100 }],
  })),
}));

const { getOrCompute } = require('../services/budgetAnalysisService');
const { callAnthropic } = require('../services/budgetAnalysis/anthropic');

function makeDb({ ops = [], history = [], cats = [], recurring = [] } = {}) {
  let cached = null;
  return {
    operations: {
      findByDateRange: vi.fn(async (start, end /*, userId */) => {
        const s = new Date(start); const e = new Date(end);
        return [...ops, ...history].filter((o) => {
          const d = new Date(o.date); return d >= s && d < e;
        });
      }),
    },
    categories: { findByUser: vi.fn(async () => cats) },
    recurringOps: { findByUser: vi.fn(async () => recurring) },
    budgetAnalyses: {
      findOne: vi.fn(async () => cached),
      upsert:  vi.fn(async (row) => { cached = { ...row, updatedAt: 'now' }; }),
    },
  };
}

beforeEach(() => callAnthropic.mockClear());

describe('getOrCompute', () => {
  const cats = [{ _id: 'c1', label: 'X', kind: 'debit', maxAmount: 100 }];
  const ops = [{ _id: 'o1', date: '2026-06-03T00:00:00.000Z', amount: -10, categoryId: 'c1', label: 'a' }];

  it('appelle Claude la 1re fois et stocke', async () => {
    const db = makeDb({ ops, cats });
    const out = await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: false });
    expect(callAnthropic).toHaveBeenCalledTimes(1);
    expect(out.stale).toBe(false);
    expect(out.analysis.summary).toBe('live');
    expect(db.budgetAnalyses.upsert).toHaveBeenCalled();
  });

  it('cache hit : digest inchangé → pas d\'appel', async () => {
    const db = makeDb({ ops, cats });
    await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: false });
    callAnthropic.mockClear();
    const out2 = await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: false });
    expect(callAnthropic).not.toHaveBeenCalled();
    expect(out2.stale).toBe(false);
  });

  it('force: true bypass le cache', async () => {
    const db = makeDb({ ops, cats });
    await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: false });
    callAnthropic.mockClear();
    await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: true });
    expect(callAnthropic).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2 : Run, voir échec**

```bash
yarn --cwd server test budgetAnalysisService
```

- [ ] **Step 3 : Implémenter le service**

Créer `server/services/budgetAnalysisService.js` :

```js
const { digestOps } = require('./budgetAnalysis/digest');
const { buildPayload } = require('./budgetAnalysis/payload');
const { validateResponse } = require('./budgetAnalysis/validate');
const { callAnthropic } = require('./budgetAnalysis/anthropic');
const { ANTHROPIC_MODEL_DEFAULT } = require('./budgetAnalysis/prompt');

function monthBounds(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}
function historyBounds(year, month) {
  const start = new Date(Date.UTC(year, month - 7, 1, 0, 0, 0));
  const end   = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  return { start, end };
}

async function loadInputs({ db, userId, year, month }) {
  const { start: mStart, end: mEnd } = monthBounds(year, month);
  const { start: hStart, end: hEnd } = historyBounds(year, month);
  const [currentMonthOps, historyOps, categories, recurring] = await Promise.all([
    db.operations.findByDateRange(mStart, mEnd, userId),
    db.operations.findByDateRange(hStart, hEnd, userId),
    db.categories.findByUser(userId),
    db.recurringOps.findByUser(userId),
  ]);
  return { currentMonthOps, historyOps, categories, recurring };
}

async function getOrCompute({ db, userId, year, month, force = false }) {
  const { currentMonthOps, historyOps, categories, recurring } =
    await loadInputs({ db, userId, year, month });

  const opsDigest = digestOps(currentMonthOps);
  const cached = await db.budgetAnalyses.findOne({ userId, year, month });

  if (!force && cached && cached.opsDigest === opsDigest) {
    return {
      analysis: cached.response,
      cachedAt: cached.updatedAt,
      opsDigest,
      stale: false,
      model: cached.model,
    };
  }

  const payload = buildPayload({
    year, month, categories, recurring, currentMonthOps, historyOps,
  });
  const allowedCatIds = new Set(categories.map((c) => String(c._id)));

  const response = await callAnthropic({ payload, allowedCatIds });
  validateResponse(response, allowedCatIds);

  const model = process.env.ANTHROPIC_MODEL || ANTHROPIC_MODEL_DEFAULT;
  await db.budgetAnalyses.upsert({ userId, year, month, opsDigest, response, model });
  return { analysis: response, cachedAt: new Date().toISOString(), opsDigest, stale: false, model };
}

async function checkStale({ db, userId, year, month }) {
  const cached = await db.budgetAnalyses.findOne({ userId, year, month });
  if (!cached) return null;
  const { start, end } = monthBounds(year, month);
  const ops = await db.operations.findByDateRange(start, end, userId);
  const stale = digestOps(ops) !== cached.opsDigest;
  return {
    analysis: cached.response,
    cachedAt: cached.updatedAt,
    opsDigest: cached.opsDigest,
    stale,
    model: cached.model,
  };
}

module.exports = { getOrCompute, checkStale };
```

- [ ] **Step 4 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysisService
yarn --cwd server lint
git add server/services/budgetAnalysisService.js server/tests/budgetAnalysisService.test.js
git commit -m "feat(server): getOrCompute orchestrator with cache invalidation"
```

---

## Phase E — Routes Express

### Task E.1 : Rate-limit dédié

**Files:**
- Create: `server/middleware/rateLimitAnalysis.js`

- [ ] **Step 1 : Implémenter**

Créer `server/middleware/rateLimitAnalysis.js` :

```js
const rateLimit = require('express-rate-limit');

// La limite analyse est plus stricte que la limite globale RATE_LIMIT_MAX :
// elle protège un appel coûteux (tokens Anthropic). En NODE_ENV=test on lit
// ANALYSIS_RATE_LIMIT_MAX si présent (utile pour le test du 429), sinon 1000
// (les E2E spamment l'API ; le 429 dédié est testé séparément).
function resolveMax() {
  if (process.env.NODE_ENV === 'test') {
    const v = Number(process.env.ANALYSIS_RATE_LIMIT_MAX);
    return Number.isInteger(v) && v > 0 ? v : 1000;
  }
  return 10;
}

module.exports = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: resolveMax(),
  keyGenerator: (req) => (req.user && String(req.user.id)) || req.ip,
  message: { message: 'Trop d\'analyses cette heure. Réessayez plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

NB : en prod la limite est de 10/h/user (hard-coded). En `NODE_ENV=test`, par défaut on relâche à 1000 ; un test dédié au 429 utilise `process.env.ANALYSIS_RATE_LIMIT_MAX = '2'` au beforeAll pour vérifier la limite.

- [ ] **Step 2 : Lint + commit**

```bash
yarn --cwd server lint
git add server/middleware/rateLimitAnalysis.js
git commit -m "feat(server): rate-limit middleware for budget analysis route"
```

---

### Task E.2 : Route GET

**Files:**
- Create: `server/routes/budgetAnalyses.js`
- Modify: `server/app.js` (mount)

- [ ] **Step 1 : Test**

Créer `server/tests/budgetAnalysesRoutes.test.js` :

```js
const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('vitest');
const request = require('supertest');
const { setup, teardown, clearDB, createVerifiedUser } = require('./helpers');

let ctx;
beforeAll(async () => { process.env.MOCK_ANTHROPIC = '1'; ctx = await setup(); });
afterAll(async () => { delete process.env.MOCK_ANTHROPIC; await teardown(ctx); });
beforeEach(() => clearDB(ctx));

async function loginAgent(email = 'u@u.u', password = 'Password1!') {
  const { user } = await createVerifiedUser(ctx, { email, password });
  const agent = request.agent(ctx.app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return { agent, user };
}

describe('GET /api/budget-analyses', () => {
  it('404 quand pas de cache pour le mois', async () => {
    const { agent } = await loginAgent();
    await agent.get('/api/budget-analyses?year=2026&month=6').expect(404);
  });

  it('400 si year ou month manquant', async () => {
    const { agent } = await loginAgent();
    await agent.get('/api/budget-analyses?year=2026').expect(400);
    await agent.get('/api/budget-analyses?month=6').expect(400);
  });
});
```

- [ ] **Step 2 : Implémenter `routes/budgetAnalyses.js` (GET uniquement pour l'instant)**

Créer `server/routes/budgetAnalyses.js` :

```js
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { getOrCompute, checkStale } = require('../services/budgetAnalysisService');
const { BudgetAnalysisValidationError } = require('../services/budgetAnalysis/validate');
const { AnthropicError } = require('../services/budgetAnalysis/anthropic');
const rateLimitAnalysis = require('../middleware/rateLimitAnalysis');

const router = express.Router();

function parseYearMonth(req, res) {
  const y = Number(req.query.year ?? req.body?.year);
  const m = Number(req.query.month ?? req.body?.month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100
      || !Number.isInteger(m) || m < 1 || m > 12) {
    res.status(400).json({ message: 'Paramètres year/month invalides' });
    return null;
  }
  return { year: y, month: m };
}

router.get('/', asyncHandler(async (req, res) => {
  const ym = parseYearMonth(req, res);
  if (!ym) return;
  const result = await checkStale({
    db: req.app.locals.db, userId: req.user.id, ...ym,
  });
  if (!result) return res.status(404).json({ message: 'Pas d\'analyse pour ce mois' });
  res.json(result);
}));

// POST + apply-suggestion ajoutés dans les tâches suivantes.

module.exports = router;
```

- [ ] **Step 3 : Monter la route dans `app.js`**

Ouvrir `server/app.js` et ajouter, après `app.use('/api/admin', ...)`:

```js
app.use('/api/budget-analyses', requireAuth, require('./routes/budgetAnalyses'));
```

- [ ] **Step 4 : Run + commit**

```bash
yarn --cwd server test budgetAnalysesRoutes
yarn --cwd server lint
git add server/routes/budgetAnalyses.js server/app.js server/tests/budgetAnalysesRoutes.test.js
git commit -m "feat(server): GET /api/budget-analyses (cache lookup + stale flag)"
```

---

### Task E.3 : Route POST

**Files:**
- Modify: `server/routes/budgetAnalyses.js`
- Modify: `server/tests/budgetAnalysesRoutes.test.js`

- [ ] **Step 1 : Ajouter le test**

Dans `server/tests/budgetAnalysesRoutes.test.js`, ajouter avant la dernière accolade fermante du fichier :

```js
describe('POST /api/budget-analyses (MOCK_ANTHROPIC)', () => {
  it('renvoie 200 + analyse mock + écrit le cache', async () => {
    const { agent, user } = await loginAgent('post@u.u');
    // Créer une catégorie + une opération du mois
    const cat = await ctx.db.categories.create({
      label: 'Test', kind: 'debit', maxAmount: 100, userId: user._id,
    });
    const bank = await ctx.db.banks.create({ label: 'B', userId: user._id });
    await ctx.db.operations.create({
      label: 'X', amount: -10, date: '2026-06-03T00:00:00.000Z',
      pointed: false, bankId: bank._id, userId: user._id, categoryId: cat._id,
    });

    const r = await agent.post('/api/budget-analyses')
      .send({ year: 2026, month: 6 })
      .expect(200);
    expect(r.body.analysis.summary).toMatch(/MOCK/i);
    expect(r.body.stale).toBe(false);

    // Re-GET = même réponse, pas de nouvel appel.
    const r2 = await agent.get('/api/budget-analyses?year=2026&month=6').expect(200);
    expect(r2.body.analysis.summary).toBe(r.body.analysis.summary);
  });
});
```

- [ ] **Step 2 : Implémenter le POST**

Dans `server/routes/budgetAnalyses.js`, ajouter avant `module.exports` :

```js
router.post('/', rateLimitAnalysis, asyncHandler(async (req, res) => {
  const ym = parseYearMonth(req, res);
  if (!ym) return;
  const force = req.body?.force === true;
  try {
    const result = await getOrCompute({
      db: req.app.locals.db, userId: req.user.id, ...ym, force,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof AnthropicError) {
      return res.status(e.status || 502).json({ message: e.message });
    }
    if (e instanceof BudgetAnalysisValidationError) {
      console.warn('[budget-analysis] validation Claude:', e.message);
      return res.status(502).json({ message: 'Réponse Claude invalide, réessayez' });
    }
    throw e;
  }
}));
```

- [ ] **Step 3 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysesRoutes
yarn --cwd server lint
git add server/routes/budgetAnalyses.js server/tests/budgetAnalysesRoutes.test.js
git commit -m "feat(server): POST /api/budget-analyses (rate-limited Claude call)"
```

---

### Task E.4 : Route `apply-suggestion`

**Files:**
- Modify: `server/routes/budgetAnalyses.js`
- Modify: `server/tests/budgetAnalysesRoutes.test.js`

- [ ] **Step 1 : Test**

Ajouter au fichier de test :

```js
describe('POST /api/budget-analyses/apply-suggestion', () => {
  it('met à jour le maxAmount = suggestedBudget − Σ récurrentes', async () => {
    const { agent, user } = await loginAgent('apply@u.u');
    const cat = await ctx.db.categories.create({
      label: 'C', kind: 'debit', maxAmount: 50, userId: user._id,
    });
    const bank = await ctx.db.banks.create({ label: 'B', userId: user._id });
    await ctx.db.recurringOps.create({
      label: 'Loyer', amount: -200, dayOfMonth: 5,
      bankId: bank._id, userId: user._id, categoryId: cat._id,
    });
    // suggestedBudget total = 500. Récurrentes = 200 → maxAmount cible = 300.
    const r = await agent.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 500 })
      .expect(200);
    expect(r.body.category.maxAmount).toBe(300);
  });

  it('404 quand la catégorie appartient à un autre user', async () => {
    const { agent } = await loginAgent('me@u.u');
    const { user: other } = await createVerifiedUser(ctx, { email: 'other@u.u' });
    const cat = await ctx.db.categories.create({
      label: 'Other', kind: 'debit', userId: other._id,
    });
    await agent.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 100 })
      .expect(404);
  });

  it('400 si suggestedBudget < Σ récurrentes', async () => {
    const { agent, user } = await loginAgent('low@u.u');
    const cat = await ctx.db.categories.create({ label: 'C', kind: 'debit', userId: user._id });
    const bank = await ctx.db.banks.create({ label: 'B', userId: user._id });
    await ctx.db.recurringOps.create({
      label: 'L', amount: -500, dayOfMonth: 1,
      bankId: bank._id, userId: user._id, categoryId: cat._id,
    });
    await agent.post('/api/budget-analyses/apply-suggestion')
      .send({ categoryId: cat._id, suggestedBudget: 100 })
      .expect(400);
  });
});
```

- [ ] **Step 2 : Implémenter**

Dans `server/routes/budgetAnalyses.js`, ajouter avant `module.exports` :

```js
router.post('/apply-suggestion', asyncHandler(async (req, res) => {
  const { categoryId, suggestedBudget } = req.body || {};
  if (typeof categoryId !== 'string'
      || typeof suggestedBudget !== 'number' || suggestedBudget < 0) {
    return res.status(400).json({ message: 'categoryId/suggestedBudget invalides' });
  }
  const db = req.app.locals.db;
  const cats = await db.categories.findByUser(req.user.id);
  const cat = cats.find((c) => String(c._id) === String(categoryId));
  if (!cat) return res.status(404).json({ message: 'Catégorie introuvable' });

  const recurring = await db.recurringOps.findByUser(req.user.id);
  const recSum = recurring.reduce((s, r) => {
    const rid = String(r.categoryId?._id ?? r.categoryId ?? '');
    return rid === String(categoryId) ? s + Math.abs(Number(r.amount) || 0) : s;
  }, 0);

  if (suggestedBudget < recSum) {
    return res.status(400).json({
      message: `suggestedBudget (${suggestedBudget}) < Σ récurrentes (${recSum})`,
    });
  }
  const newMax = Math.round((suggestedBudget - recSum) * 100) / 100;

  const updated = await db.categories.update(categoryId, req.user.id, { maxAmount: newMax });
  if (!updated) return res.status(404).json({ message: 'Catégorie introuvable' });
  res.json({ category: updated });
}));
```

- [ ] **Step 3 : Run + lint + commit**

```bash
yarn --cwd server test budgetAnalysesRoutes
yarn --cwd server lint
git add server/routes/budgetAnalyses.js server/tests/budgetAnalysesRoutes.test.js
git commit -m "feat(server): POST /apply-suggestion to update category maxAmount"
```

---

## Phase F — Couche API client + hook

### Task F.1 : `client/src/api/budgetAnalyses.js`

**Files:**
- Create: `client/src/api/budgetAnalyses.js`

- [ ] **Step 1 : Écrire le module**

Créer `client/src/api/budgetAnalyses.js` :

```js
import client from './client';

export async function getAnalysis({ year, month }) {
  try {
    const res = await client.get('/api/budget-analyses', { params: { year, month } });
    return res.data;
  } catch (e) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export async function runAnalysis({ year, month, force = false }) {
  const res = await client.post('/api/budget-analyses', { year, month, force });
  return res.data;
}

export async function applySuggestion({ categoryId, suggestedBudget }) {
  const res = await client.post('/api/budget-analyses/apply-suggestion', {
    categoryId, suggestedBudget,
  });
  return res.data;
}
```

- [ ] **Step 2 : Lint + commit**

```bash
yarn --cwd client lint
git add client/src/api/budgetAnalyses.js
git commit -m "feat(client): API client for budget analyses"
```

---

### Task F.2 : `hooks/useBudgetAnalysis.js`

**Files:**
- Create: `client/src/hooks/useBudgetAnalysis.js`

- [ ] **Step 1 : Écrire le hook**

Créer `client/src/hooks/useBudgetAnalysis.js` :

```js
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getAnalysis, runAnalysis, applySuggestion as apiApply } from '@/api/budgetAnalyses';

// États : idle | loading | ready | stale | error
export function useBudgetAnalysis({ year, month }) {
  const [analysis, setAnalysis]   = useState(null);
  const [meta, setMeta]           = useState(null); // { cachedAt, opsDigest, stale, model }
  const [status, setStatus]       = useState('idle');
  const [error, setError]         = useState(null);
  const [appliedIds, setApplied]  = useState(() => new Set());

  // Charge le cache au montage et au changement de mois.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    setAnalysis(null);
    setMeta(null);
    setApplied(new Set());
    getAnalysis({ year, month })
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setStatus('idle');
        } else {
          setAnalysis(data.analysis);
          setMeta({ cachedAt: data.cachedAt, opsDigest: data.opsDigest,
                    stale: data.stale, model: data.model });
          setStatus(data.stale ? 'stale' : 'ready');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.message || 'Erreur réseau');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [year, month]);

  const run = useCallback(async ({ force = false } = {}) => {
    setStatus('loading');
    setError(null);
    try {
      const data = await runAnalysis({ year, month, force });
      setAnalysis(data.analysis);
      setMeta({ cachedAt: data.cachedAt, opsDigest: data.opsDigest,
                stale: false, model: data.model });
      setApplied(new Set());
      setStatus('ready');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Erreur réseau';
      setError(msg);
      setStatus('error');
      toast.error(msg);
    }
  }, [year, month]);

  const regenerate = useCallback(() => run({ force: true }), [run]);

  const applySuggestion = useCallback(async ({ categoryId, suggestedBudget }) => {
    try {
      const data = await apiApply({ categoryId, suggestedBudget });
      setApplied((prev) => {
        const next = new Set(prev); next.add(categoryId); return next;
      });
      toast.success(`Budget mis à jour pour ${data.category.label}`);
      return data.category;
    } catch (e) {
      const msg = e?.response?.data?.message || 'Erreur lors de la mise à jour';
      toast.error(msg);
      throw e;
    }
  }, []);

  return { analysis, meta, status, error, appliedIds, run, regenerate, applySuggestion };
}
```

- [ ] **Step 2 : Lint + commit**

```bash
yarn --cwd client lint
git add client/src/hooks/useBudgetAnalysis.js
git commit -m "feat(client): useBudgetAnalysis hook with state machine"
```

---

## Phase G — Page React

### Task G.1 : Squelette de page + MonthNavigator + états

**Files:**
- Create: `client/src/pages/BudgetAnalysisPage.jsx`

- [ ] **Step 1 : Squelette de page**

Créer `client/src/pages/BudgetAnalysisPage.jsx` :

```jsx
import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBudgetAnalysis } from '@/hooks/useBudgetAnalysis';
import { useCategories } from '@/hooks/useCategories';
import { getCookiePref, setCookiePref } from '@/lib/cookieUtils';
import AnalysisDisplay from '@/components/budgetAnalysis/AnalysisDisplay';

const COOKIE_NAME = 'analysis_month';

export default function BudgetAnalysisPage() {
  const [monthOffset, setMonthOffsetRaw] = useState(
    () => getCookiePref(COOKIE_NAME)?.monthOffset ?? 0,
  );
  const setMonthOffset = (next) => {
    setMonthOffsetRaw((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      setCookiePref(COOKIE_NAME, { monthOffset: v });
      return v;
    });
  };

  const { year, month, label } = useMemo(() => {
    const m = dayjs().add(monthOffset, 'month');
    return { year: m.year(), month: m.month() + 1, label: m.format('MMMM YYYY') };
  }, [monthOffset]);

  const { categories } = useCategories();
  const {
    analysis, meta, status, error, appliedIds, run, regenerate, applySuggestion,
  } = useBudgetAnalysis({ year, month });

  const canGoForward = monthOffset < 0;
  const canGoBack    = monthOffset > -24;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Analyse budgétaire IA</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!canGoBack}
            onClick={() => setMonthOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[8rem] text-center text-sm font-medium capitalize">{label}</span>
          <Button variant="ghost" size="icon" disabled={!canGoForward}
            onClick={() => setMonthOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {status === 'idle' && (
            <Button onClick={() => run()}><Sparkles className="mr-1.5 h-4 w-4" />Analyser ce mois</Button>
          )}
          {(status === 'ready' || status === 'stale') && (
            <Button variant="outline" onClick={regenerate}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Régénérer
            </Button>
          )}
        </div>
      </header>

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Claude analyse les opérations du mois…
        </div>
      )}

      {status === 'stale' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Les opérations du mois ont changé depuis cette analyse.
          </span>
          <Button size="sm" variant="outline" onClick={regenerate}>Régénérer</Button>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <Button size="sm" variant="ghost" className="ml-2" onClick={() => run()}>Réessayer</Button>
        </div>
      )}

      {status === 'idle' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucune analyse pour {label}. Cliquez sur <strong>Analyser ce mois</strong> pour générer une analyse Claude.
          </p>
        </div>
      )}

      {analysis && (status === 'ready' || status === 'stale') && (
        <AnalysisDisplay
          analysis={analysis} categories={categories}
          appliedIds={appliedIds} onApply={applySuggestion}
          meta={meta}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Lint (ne pas tester encore — AnalysisDisplay n'existe pas)**

Pas de lint encore : l'import `AnalysisDisplay` va planter. On l'ajoute Task G.2 puis on commit la page complète.

---

### Task G.2 : `AnalysisDisplay` + sous-composants texte

**Files:**
- Create: `client/src/components/budgetAnalysis/AnalysisDisplay.jsx`
- Create: `client/src/components/budgetAnalysis/SummaryCard.jsx`
- Create: `client/src/components/budgetAnalysis/HighlightsList.jsx`
- Create: `client/src/components/budgetAnalysis/AnomaliesList.jsx`
- Create: `client/src/components/budgetAnalysis/TrendsList.jsx`

- [ ] **Step 1 : `SummaryCard.jsx`**

```jsx
import dayjs from 'dayjs';

export default function SummaryCard({ summary, meta }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-2 text-sm font-semibold">Synthèse</h2>
      <p className="whitespace-pre-line text-sm text-foreground">{summary}</p>
      {meta?.cachedAt && (
        <p className="mt-3 text-xs text-muted-foreground">
          Généré le {dayjs(meta.cachedAt).format('DD/MM/YYYY HH:mm')} · {meta.model}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2 : `HighlightsList.jsx`**

```jsx
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

const STYLE = {
  critical: { Icon: AlertCircle,   cls: 'border-destructive/40 bg-destructive/10 text-destructive' },
  warning:  { Icon: AlertTriangle, cls: 'border-warning/40 bg-warning/10' },
  info:     { Icon: Info,          cls: 'border-border bg-card' },
  positive: { Icon: CheckCircle2,  cls: 'border-success/40 bg-success/10' },
};

export default function HighlightsList({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Points marquants</h2>
      <ul className="space-y-2">
        {highlights.map((h, i) => {
          const { Icon, cls } = STYLE[h.severity] || STYLE.info;
          return (
            <li key={i} className={`flex gap-2 rounded-lg border p-2.5 text-sm ${cls}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{h.title}</div>
                <div className="text-foreground/90">{h.detail}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3 : `AnomaliesList.jsx`**

```jsx
import { AlertTriangle } from 'lucide-react';

export default function AnomaliesList({ anomalies, categories }) {
  if (!anomalies?.length) return null;
  const catLabel = (id) => categories.find((c) => String(c._id) === String(id))?.label;
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Anomalies détectées</h2>
      <ul className="space-y-2">
        {anomalies.map((a, i) => (
          <li key={i} className="flex gap-2 rounded-lg border border-border bg-background p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <div className="font-medium">{a.title}</div>
              <div className="text-muted-foreground">{a.detail}</div>
              {a.categoryId && catLabel(a.categoryId) && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Catégorie : {catLabel(a.categoryId)}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4 : `TrendsList.jsx`**

```jsx
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

const ICONS = { up: TrendingUp, down: TrendingDown, stable: Minus };
const COLORS = { up: 'text-debit', down: 'text-credit', stable: 'text-muted-foreground' };

export default function TrendsList({ trends, categories }) {
  if (!trends?.length) return null;
  const catLabel = (id) => categories.find((c) => String(c._id) === String(id))?.label || 'Inconnue';
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Tendances</h2>
      <ul className="space-y-1.5">
        {trends.map((t, i) => {
          const Icon = ICONS[t.direction] || Minus;
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${COLORS[t.direction]}`} />
              <div>
                <span className="font-medium">{catLabel(t.categoryId)}</span>{' '}
                <span className={COLORS[t.direction]}>
                  {t.direction === 'stable' ? 'stable' : `${t.direction === 'up' ? '+' : '−'}${Math.abs(t.magnitudePct).toFixed(0)}%`}
                </span>
                <span className="text-muted-foreground"> — {t.comment}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5 : `AnalysisDisplay.jsx` (orchestrateur)**

```jsx
import { lazy, Suspense } from 'react';
import SummaryCard from './SummaryCard';
import HighlightsList from './HighlightsList';
import AnomaliesList from './AnomaliesList';
import TrendsList from './TrendsList';
import BudgetSuggestionsCard from './BudgetSuggestionsCard';
import ChartFallback from '@/components/ChartFallback';

const CategoryDonut = lazy(() => import('./CategoryDonut'));

export default function AnalysisDisplay({ analysis, categories, meta, appliedIds, onApply }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4 md:col-span-2">
        <SummaryCard summary={analysis.summary} meta={meta} />
      </div>
      <HighlightsList highlights={analysis.highlights} />
      <AnomaliesList anomalies={analysis.anomalies} categories={categories} />
      <TrendsList trends={analysis.trends} categories={categories} />
      <Suspense fallback={<ChartFallback height={260} />}>
        <CategoryDonut data={analysis.categoryBreakdown} categories={categories} />
      </Suspense>
      <div className="md:col-span-2">
        <BudgetSuggestionsCard
          suggestions={analysis.budgetSuggestions}
          categories={categories}
          appliedIds={appliedIds}
          onApply={onApply}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6 : Lint check partiel (BudgetSuggestionsCard et CategoryDonut viendront en G.3/G.4)**

Pas de commit ni de lint full encore — on attend G.4.

---

### Task G.3 : `CategoryDonut` (recharts lazy)

**Files:**
- Create: `client/src/components/budgetAnalysis/CategoryDonut.jsx`

- [ ] **Step 1 : Implémenter**

```jsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DEFAULT_COLOR } from '@/lib/categoryColors';
import { formatEur } from '@/lib/utils';

export default function CategoryDonut({ data, categories }) {
  if (!data?.length) return null;
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const rows = data
    .map((d) => {
      const c = byId.get(String(d.categoryId));
      return {
        name: c?.label || 'Catégorie',
        color: c?.color || DEFAULT_COLOR,
        amount: d.amount,
        share: d.share,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Répartition des dépenses</h2>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="amount" nameKey="name"
              innerRadius={50} outerRadius={90} paddingAngle={2}>
              {rows.map((r, i) => <Cell key={i} fill={r.color} />)}
            </Pie>
            <Tooltip formatter={(v, _n, p) => [
              `${formatEur(v)} (${(p.payload.share * 100).toFixed(0)}%)`,
              p.payload.name,
            ]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Lint + on attend G.4 pour commit**

---

### Task G.4 : `BudgetSuggestionsCard` + commit du tout

**Files:**
- Create: `client/src/components/budgetAnalysis/BudgetSuggestionsCard.jsx`

- [ ] **Step 1 : Implémenter**

```jsx
import { useState } from 'react';
import { Check, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategoryBadge from '@/components/CategoryBadge';
import { formatEur } from '@/lib/utils';

export default function BudgetSuggestionsCard({ suggestions, categories, appliedIds, onApply }) {
  const [busyId, setBusyId] = useState(null);
  if (!suggestions?.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <h2 className="mb-3 text-sm font-semibold">Suggestions de budget</h2>
      <ul className="divide-y divide-border">
        {suggestions.map((s) => {
          const isApplied = appliedIds.has(s.categoryId);
          const delta = s.suggestedBudget - s.currentBudget;
          return (
            <li key={s.categoryId}
              className={`flex flex-wrap items-center gap-3 py-2.5 ${isApplied ? 'opacity-60' : ''}`}>
              <div className="min-w-[8rem]">
                <CategoryBadge categoryId={s.categoryId} categories={categories} />
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground">{formatEur(s.currentBudget)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{formatEur(s.suggestedBudget)}</span>
                <span className={`ml-1 text-xs ${delta >= 0 ? 'text-debit' : 'text-credit'}`}>
                  ({delta >= 0 ? '+' : ''}{formatEur(delta)})
                </span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">{s.rationale}</p>
              {isApplied ? (
                <span className="inline-flex items-center gap-1 text-xs text-credit">
                  <Check className="h-3.5 w-3.5" /> Appliqué
                </span>
              ) : (
                <Button size="sm" variant="outline"
                  disabled={busyId === s.categoryId || delta === 0}
                  onClick={async () => {
                    setBusyId(s.categoryId);
                    try {
                      await onApply({ categoryId: s.categoryId, suggestedBudget: s.suggestedBudget });
                    } finally { setBusyId(null); }
                  }}>
                  {busyId === s.categoryId
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : 'Appliquer'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2 : Lint + commit pour toute la phase G (page + composants)**

```bash
yarn --cwd client lint
git add client/src/pages/BudgetAnalysisPage.jsx client/src/components/budgetAnalysis/
git commit -m "feat(client): /analysis page with summary/highlights/donut/suggestions"
```

---

### Task G.5 : Route + nav sidebar/bottom-nav

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/layout/AppShell.jsx`

- [ ] **Step 1 : Ajouter la route dans `App.jsx`**

Dans le bloc des `const X = lazy(...)` :

```jsx
const BudgetAnalysisPage = lazy(() => import('@/pages/BudgetAnalysisPage'));
```

Dans la liste des routes protégées, après `<Route path="categories" .../>` :

```jsx
<Route path="analysis" element={<BudgetAnalysisPage />} />
```

- [ ] **Step 2 : Ajouter la nav dans `AppShell.jsx`**

Repérer la liste des items (sidebar + bottom-nav). Ajouter une entrée :

```jsx
{ to: '/analysis', label: 'Analyse', icon: Sparkles }
```

(import `Sparkles` depuis `lucide-react` en haut du fichier).

Placement :
- Sidebar desktop : entre "Catégories" et "Profil"
- Bottom-nav mobile : en 6e position

- [ ] **Step 3 : Lint + commit**

```bash
yarn --cwd client lint
git add client/src/App.jsx client/src/components/layout/AppShell.jsx
git commit -m "feat(client): expose /analysis route in sidebar and bottom-nav"
```

---

## Phase H — E2E + docs

### Task H.1 : Test Playwright

**Files:**
- Create: `e2e/specs/budget-analysis.spec.js`
- Modify: `e2e/playwright.config.js` (ajout `MOCK_ANTHROPIC=1`)

- [ ] **Step 1 : Activer le mock en E2E**

Dans `e2e/playwright.config.js`, dans la section `env` du webServer (ou équivalent), ajouter :

```js
MOCK_ANTHROPIC: '1',
```

- [ ] **Step 2 : Écrire le test**

Créer `e2e/specs/budget-analysis.spec.js` :

```js
const { test, expect } = require('@playwright/test');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'e2e-admin@test.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'e2eAdminPass123';

async function login(page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL('**/');
}

test.describe('/analysis page', () => {
  test('EmptyState et bouton Analyser visibles', async ({ page }) => {
    await login(page);
    await page.goto('/analysis');
    await expect(page.getByRole('heading', { name: /Analyse budgétaire IA/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Analyser ce mois/i })).toBeVisible();
  });

  test('Clic sur Analyser → rendu de la synthèse (mock)', async ({ page }) => {
    await login(page);
    await page.goto('/analysis');
    await page.getByRole('button', { name: /Analyser ce mois/i }).click();
    await expect(page.getByText(/MOCK_ANTHROPIC/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Régénérer/i })).toBeVisible();
  });
});
```

- [ ] **Step 3 : Lancer**

```bash
cd e2e && yarn test --grep "/analysis"
```

Attendu : 2 tests passent.

- [ ] **Step 4 : Commit**

```bash
git add e2e/specs/budget-analysis.spec.js e2e/playwright.config.js
git commit -m "test(e2e): /analysis page basic flow with MOCK_ANTHROPIC"
```

---

### Task H.2 : Mise à jour CLAUDE.md racine (vérification finale)

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Vérifier que la section Environment liste les variables**

Re-vérifier que la section `### server/.env (gitignored)` du `CLAUDE.md` racine contient bien (ajouté Task A.1) :

```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
MOCK_ANTHROPIC=
```

Sinon, les ajouter.

- [ ] **Step 2 : Ajouter une ligne dans la section Architecture**

Sous la section "Modèle de domaine", ajouter (après la table des entités) :

```markdown
- **BudgetAnalysis** — `userId`, `year`, `month`, `opsDigest`, `response` (JSON), `model`.
  Cache d'analyse Claude par mois ; invalidé quand `digestOps` du mois change.
  Voir `server/services/budgetAnalysisService.js`.
```

- [ ] **Step 3 : Tests finaux complets**

```bash
yarn --cwd server lint && yarn --cwd server test
yarn --cwd client lint && yarn --cwd client test --run
```

Attendu : 0 warning, 0 test échoué.

- [ ] **Step 4 : Validation Playwright manuelle (skill webapp-testing)**

Démarrer `yarn dev` racine, puis via `mcp__playwright__*` :
1. Login.
2. Naviguer sur `/analysis`.
3. Cliquer "Analyser ce mois".
4. Vérifier zéro erreur console.
5. Screenshot du résultat.

- [ ] **Step 5 : Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: document BudgetAnalysis entity and Anthropic env vars"
```

---

## Récapitulatif des fichiers

**Créés (serveur)**
- `server/services/budgetAnalysis/digest.js`
- `server/services/budgetAnalysis/payload.js`
- `server/services/budgetAnalysis/validate.js`
- `server/services/budgetAnalysis/prompt.js`
- `server/services/budgetAnalysis/anthropic.js`
- `server/services/budgetAnalysisService.js`
- `server/routes/budgetAnalyses.js`
- `server/middleware/rateLimitAnalysis.js`
- `server/tests/budgetAnalysisDigest.test.js`
- `server/tests/budgetAnalysisPayload.test.js`
- `server/tests/budgetAnalysisValidate.test.js`
- `server/tests/budgetAnalysisAnthropic.test.js`
- `server/tests/budgetAnalysisService.test.js`
- `server/tests/budgetAnalysesRoutes.test.js`
- `server/tests/budgetAnalysesRepo.test.js`

**Modifiés (serveur)**
- `server/db/sqlite.js`
- `server/db/mongo.js`
- `server/app.js`
- `server/package.json`
- `server/.env.example`

**Créés (client)**
- `client/src/api/budgetAnalyses.js`
- `client/src/hooks/useBudgetAnalysis.js`
- `client/src/pages/BudgetAnalysisPage.jsx`
- `client/src/components/budgetAnalysis/AnalysisDisplay.jsx`
- `client/src/components/budgetAnalysis/SummaryCard.jsx`
- `client/src/components/budgetAnalysis/HighlightsList.jsx`
- `client/src/components/budgetAnalysis/AnomaliesList.jsx`
- `client/src/components/budgetAnalysis/TrendsList.jsx`
- `client/src/components/budgetAnalysis/CategoryDonut.jsx`
- `client/src/components/budgetAnalysis/BudgetSuggestionsCard.jsx`

**Modifiés (client)**
- `client/src/App.jsx`
- `client/src/components/layout/AppShell.jsx`

**E2E**
- `e2e/specs/budget-analysis.spec.js` (créé)
- `e2e/playwright.config.js` (modifié)

**Racine**
- `CLAUDE.md` (modifié)

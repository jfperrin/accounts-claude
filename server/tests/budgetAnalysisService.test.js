import { describe, it, expect, vi, beforeEach } from 'vitest';

// The `= new Set()` default guards against vitest 4.x calling vi.fn impls with undefined
// during top-level await import teardown — real calls always pass a populated Set.
// Le mock renvoie un categoryBreakdown.amount qui matche le total des ops du
// payload : le validator vérifie maintenant cette cohérence pour bloquer les
// hallucinations Claude (cf. cas 158→382). Le test ops total = 10 € débit.
vi.mock('../services/budgetAnalysis/anthropic.js', () => ({
  callAnthropic: vi.fn(async ({ payload = {}, allowedCatIds = new Set() } = {}) => {
    const totals = payload.currentMonth?.totalsByCategory ?? [];
    const breakdown = totals
      .filter((t) => t.totalDebit > 0 || t.totalCredit > 0)
      .map((t) => ({
        categoryId: t.categoryId,
        share: 1 / totals.length,
        amount: Math.max(t.totalDebit, t.totalCredit),
      }));
    return {
      summary: 'live',
      highlights: [], anomalies: [], trends: [],
      budgetSuggestions: [...allowedCatIds].length ? [{
        categoryId: [...allowedCatIds][0], currentBudget: 100, suggestedBudget: 150, rationale: 'r',
      }] : [],
      categoryBreakdown: breakdown,
    };
  }),
  AnthropicError: class extends Error {},
}));

const { getOrCompute } = await import('../services/budgetAnalysisService.js');
const { callAnthropic } = await import('../services/budgetAnalysis/anthropic.js');

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

  it('écrase categoryBreakdown.amount avec le total kind-aligné serveur', async () => {
    // Catégorie débit mixte : 1350,89 € de dépenses + 70 € remboursement.
    // Le mock Claude renvoie amount=70 (totalCredit) — le serveur doit le
    // réécrire à 1350,89 (totalDebit, kind=debit).
    const mixedCats = [{ _id: 'cMix', label: 'Shopping', kind: 'debit', maxAmount: 0 }];
    const mixedOps = [
      { _id: 'd1', date: '2026-06-02T00:00:00.000Z', amount: -800,    categoryId: 'cMix', label: 'a' },
      { _id: 'd2', date: '2026-06-05T00:00:00.000Z', amount: -550.89, categoryId: 'cMix', label: 'b' },
      { _id: 'c1', date: '2026-06-10T00:00:00.000Z', amount:  70,     categoryId: 'cMix', label: 'refund' },
    ];
    // Override le mock pour ce test : Claude renvoie le credit (70), pas le max.
    callAnthropic.mockImplementationOnce(async ({ payload }) => {
      const totals = payload.currentMonth.totalsByCategory;
      return {
        summary: 'live',
        highlights: [], anomalies: [], trends: [], budgetSuggestions: [],
        categoryBreakdown: totals.map((t) => ({
          categoryId: t.categoryId,
          share: 1,
          amount: t.totalCredit, // Claude pioche dans la mauvaise direction
        })),
      };
    });
    const db = makeDb({ ops: mixedOps, cats: mixedCats });
    const out = await getOrCompute({ db, userId: 'u', year: 2026, month: 6, force: false });
    expect(out.analysis.categoryBreakdown).toHaveLength(1);
    expect(out.analysis.categoryBreakdown[0].amount).toBe(1350.89);
    expect(out.analysis.categoryBreakdown[0].share).toBe(1);
  });
});

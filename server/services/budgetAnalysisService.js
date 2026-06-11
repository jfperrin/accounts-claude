const { digestOps } = require('./budgetAnalysis/digest');
const { buildPayload, computeTotalsByCategory } = require('./budgetAnalysis/payload');
const { validateResponse } = require('./budgetAnalysis/validate');
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

  // Dynamic import so vitest vi.mock() can intercept in tests
  // (CJS require() bypasses the ESM mock registry).
  const { callAnthropic } = await import('./budgetAnalysis/anthropic.js');
  const response = await callAnthropic({ payload, allowedCatIds });
  const serverTotals = computeTotalsByCategory(currentMonthOps);
  validateResponse(response, allowedCatIds, serverTotals);
  overrideCategoryBreakdown(response, categories, serverTotals);

  const model = process.env.ANTHROPIC_MODEL || ANTHROPIC_MODEL_DEFAULT;
  await db.budgetAnalyses.upsert({ userId, year, month, opsDigest, response, model });
  return { analysis: response, cachedAt: new Date().toISOString(), opsDigest, stale: false, model };
}

// Réécrit categoryBreakdown[].amount avec la valeur serveur alignée sur le kind
// de la catégorie (totalDebit pour debit, totalCredit pour credit), puis
// recalcule share. Évite que le donut affiche un remboursement isolé (70 €)
// à la place de l'expenditure brute (1350 €) sur catégorie mixte.
function overrideCategoryBreakdown(response, categories, serverTotals) {
  if (!Array.isArray(response?.categoryBreakdown)) return;
  const catById = new Map(categories.map((c) => [String(c._id), c]));
  const corrected = response.categoryBreakdown.map((b) => {
    const t = serverTotals.get(String(b.categoryId));
    if (!t) return b;
    const cat = catById.get(String(b.categoryId));
    const kind = cat?.kind === 'credit' ? 'credit' : 'debit';
    const amount = kind === 'credit' ? t.totalCredit : t.totalDebit;
    return { ...b, amount: Math.round(amount * 100) / 100 };
  });
  const total = corrected.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  response.categoryBreakdown = corrected.map((b) => ({
    ...b,
    share: total > 0 ? Math.round((b.amount / total) * 10000) / 10000 : 0,
  }));
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

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
    db: req.app.locals.db, userId: req.user._id, ...ym,
  });
  if (!result) return res.status(404).json({ message: 'Pas d\'analyse pour ce mois' });
  res.json(result);
}));

router.post('/', rateLimitAnalysis, asyncHandler(async (req, res) => {
  const ym = parseYearMonth(req, res);
  if (!ym) return;
  const force = req.body?.force === true;
  try {
    const result = await getOrCompute({
      db: req.app.locals.db, userId: req.user._id, ...ym, force,
    });
    return res.json(result);
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

router.post('/apply-suggestion', asyncHandler(async (req, res) => {
  const { categoryId, suggestedBudget } = req.body || {};
  if (typeof categoryId !== 'string'
      || typeof suggestedBudget !== 'number' || suggestedBudget < 0) {
    return res.status(400).json({ message: 'categoryId/suggestedBudget invalides' });
  }
  const db = req.app.locals.db;
  const cats = await db.categories.findByUser(req.user._id);
  const cat = cats.find((c) => String(c._id) === String(categoryId));
  if (!cat) return res.status(404).json({ message: 'Catégorie introuvable' });

  const recurring = await db.recurringOps.findByUser(req.user._id);
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

  const updated = await db.categories.update(categoryId, req.user._id, { maxAmount: newMax });
  if (!updated) return res.status(404).json({ message: 'Catégorie introuvable' });
  return res.json({ category: updated });
}));

module.exports = router;

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

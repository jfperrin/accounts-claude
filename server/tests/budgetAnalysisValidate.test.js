import { describe, it, expect } from 'vitest';
import { validateResponse } from '../services/budgetAnalysis/validate.js';

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
    const bad = { ...valid };
    delete bad.summary;
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

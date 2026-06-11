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

  describe('anti-hallucination — vérification des amount via serverTotals', () => {
    const serverTotals = new Map([
      ['c1', { totalDebit: 200, totalCredit: 0, opsCount: 5 }],
    ]);

    it('accepte un amount qui matche serverTotals (à 1€ près)', () => {
      const ok = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 200.5 }] };
      expect(() => validateResponse(ok, allowed, serverTotals)).not.toThrow();
    });

    it('rejette un amount qui diverge du serveur (>1€)', () => {
      const bad = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 382 }] };
      expect(() => validateResponse(bad, allowed, serverTotals)).toThrow(/debit=200/);
    });

    it('accepte une catégorie mixte si amount matche totalCredit (cas refund)', () => {
      const totals = new Map([
        ['c1', { totalDebit: 1350.89, totalCredit: 70, opsCount: 10 }],
      ]);
      const okCredit = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 70 }] };
      const okDebit  = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 1350.89 }] };
      expect(() => validateResponse(okCredit, allowed, totals)).not.toThrow();
      expect(() => validateResponse(okDebit,  allowed, totals)).not.toThrow();
    });

    it('rejette une catégorie mixte si amount ne matche ni debit ni credit', () => {
      const totals = new Map([
        ['c1', { totalDebit: 1350.89, totalCredit: 70, opsCount: 10 }],
      ]);
      const bad = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 500 }] };
      expect(() => validateResponse(bad, allowed, totals)).toThrow(/debit=1350\.89/);
    });

    it('rejette une catégorie sans op réelle ce mois', () => {
      const bad = { ...valid, categoryBreakdown: [{ categoryId: 'c2', share: 1, amount: 50 }] };
      expect(() => validateResponse(bad, allowed, serverTotals)).toThrow(/sans op réelle/);
    });

    it('accepte les credits (catégorie où totalCredit > totalDebit)', () => {
      const totals = new Map([
        ['c1', { totalDebit: 0, totalCredit: 1500, opsCount: 1 }],
      ]);
      const ok = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 1, amount: 1500 }] };
      expect(() => validateResponse(ok, allowed, totals)).not.toThrow();
    });

    it('serverTotals absent : pas de garde-fou (comportement legacy)', () => {
      const stillOk = { ...valid, categoryBreakdown: [{ categoryId: 'c1', share: 0.5, amount: 9999 }] };
      expect(() => validateResponse(stillOk, allowed)).not.toThrow();
    });
  });
});

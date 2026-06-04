import { describe, it, expect } from 'vitest';
import { computeBudgetRows, directional, roundBudgetUp } from '../lib/budget';

// computeBudgetRows reçoit des opérations DÉJÀ filtrées des virements internes
// (le filtrage transferId est fait par l'appelant, cf. HomePage).
const cat = ({
  id = 'c1', label = 'Courses', kind = 'debit', maxAmount = 0, color = '#abc', parentId,
} = {}) => ({ _id: id, label, kind, maxAmount, color, parentId });

const op = ({
  id = 'o1', amount = -10, categoryId = 'c1', date = '2026-05-10',
} = {}) => ({ _id: id, amount, categoryId, date });

const recur = ({
  id = 'r1', amount = -10, categoryId = 'c1',
} = {}) => ({ _id: id, amount, categoryId });

describe('directional', () => {
  it('renvoie la dépense en positif pour une catégorie debit', () => {
    expect(directional(-30, 'debit')).toBe(30);
  });
  it('conserve le signe pour une catégorie credit', () => {
    expect(directional(1200, 'credit')).toBe(1200);
  });
});

describe('roundBudgetUp', () => {
  it('arrondit à la dizaine supérieure', () => {
    expect(roundBudgetUp(125)).toBe(130);
    expect(roundBudgetUp(100)).toBe(100);
    expect(roundBudgetUp(0)).toBe(0);
  });
});

describe('computeBudgetRows', () => {
  it('calcule budget arrondi et réel directionnel pour une dépense', () => {
    const { rows } = computeBudgetRows({
      categories: [cat({ maxAmount: 125 })],
      recurring: [],
      operations: [op({ amount: -30 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      budget: 130, actual: 30, overBudget: false, depth: 0,
    });
  });

  it('détecte un dépassement (debit, réel > budget > 0)', () => {
    const { rows } = computeBudgetRows({
      categories: [cat({ maxAmount: 100 })],
      recurring: [],
      operations: [op({ id: 'o1', amount: -100 }), op({ id: 'o2', amount: -42 })],
    });
    expect(rows[0]).toMatchObject({ budget: 100, actual: 142, over: 42, overBudget: true });
    expect(rows[0].ratio).toBeCloseTo(1.42, 5);
  });

  it('ne dépasse jamais un budget nul (debit sans maxAmount ni récurrente)', () => {
    const { rows } = computeBudgetRows({
      categories: [cat({ maxAmount: 0 })],
      recurring: [],
      operations: [op({ amount: -20 })],
    });
    expect(rows[0]).toMatchObject({ budget: 0, actual: 20, overBudget: false });
  });

  it('un revenu au-dessus de sa cible n’est pas un dépassement', () => {
    const { rows } = computeBudgetRows({
      categories: [cat({ id: 'cr', label: 'Salaire', kind: 'credit', maxAmount: 1000 })],
      recurring: [],
      operations: [op({ amount: 1200, categoryId: 'cr' })],
    });
    expect(rows[0]).toMatchObject({ budget: 1000, actual: 1200, overBudget: false });
  });

  it('intègre les récurrentes assignées dans le budget (arrondi dizaine)', () => {
    const { rows } = computeBudgetRows({
      categories: [cat({ maxAmount: 0 })],
      recurring: [recur({ amount: -95 })],
      operations: [],
    });
    expect(rows[0]).toMatchObject({ budget: 100, actual: 0 });
  });

  it('totalise les opérations sans catégorie séparément', () => {
    const { uncategorized } = computeBudgetRows({
      categories: [cat({ maxAmount: 50 })],
      recurring: [],
      operations: [
        op({ id: 'o1', amount: -20, categoryId: 'c1' }),
        op({ id: 'o2', amount: -15, categoryId: null }),
        op({ id: 'o3', amount: -5, categoryId: null }),
      ],
    });
    expect(uncategorized).toEqual({ count: 2, total: -20 });
  });

  it('groupe parent → enfant avec depth et place les revenus avant les dépenses', () => {
    const { rows } = computeBudgetRows({
      categories: [
        cat({ id: 'p1', label: 'Maison', kind: 'debit', maxAmount: 0 }),
        cat({ id: 'c1', label: 'Courses', kind: 'debit', maxAmount: 0, parentId: 'p1' }),
        cat({ id: 'cr', label: 'Salaire', kind: 'credit', maxAmount: 0 }),
      ],
      recurring: [],
      operations: [
        op({ id: 'o1', amount: 100, categoryId: 'cr' }),
        op({ id: 'o2', amount: -50, categoryId: 'p1' }),
        op({ id: 'o3', amount: -30, categoryId: 'c1' }),
      ],
    });
    expect(rows.map((r) => [r.cat._id, r.depth])).toEqual([
      ['cr', 0], ['p1', 0], ['c1', 1],
    ]);
  });

  it('agrège les dépassements triés par ampleur décroissante', () => {
    const { overruns } = computeBudgetRows({
      categories: [
        cat({ id: 'a', label: 'A', maxAmount: 100 }),
        cat({ id: 'b', label: 'B', maxAmount: 50 }),
        cat({ id: 'c', label: 'C', maxAmount: 100 }),
      ],
      recurring: [],
      operations: [
        op({ id: 'o1', amount: -150, categoryId: 'a' }),
        op({ id: 'o2', amount: -80, categoryId: 'b' }),
        op({ id: 'o3', amount: -20, categoryId: 'c' }),
      ],
    });
    expect(overruns.count).toBe(2);
    expect(overruns.totalOver).toBe(80);
    expect(overruns.items.map((r) => r.cat._id)).toEqual(['a', 'b']);
  });

  it('calcule les totaux revenus / dépenses / nets', () => {
    const { totals } = computeBudgetRows({
      categories: [
        cat({ id: 'cr', label: 'Salaire', kind: 'credit', maxAmount: 1000 }),
        cat({ id: 'd', label: 'Courses', kind: 'debit', maxAmount: 100 }),
      ],
      recurring: [],
      operations: [
        op({ id: 'o1', amount: 1200, categoryId: 'cr' }),
        op({ id: 'o2', amount: -142, categoryId: 'd' }),
      ],
    });
    expect(totals).toMatchObject({
      budgetCredit: 1000, budgetDebit: 100, actualCredit: 1200, actualDebit: 142,
      budgetNet: 900, actualNet: 1058,
    });
  });
});

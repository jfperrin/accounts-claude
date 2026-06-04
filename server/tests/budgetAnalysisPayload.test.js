import { describe, it, expect } from 'vitest';
import { buildPayload } from '../services/budgetAnalysis/payload.js';

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
    expect(courses.monthlyBudget).toBe(1000);
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

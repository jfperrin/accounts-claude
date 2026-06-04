import { describe, it, expect } from 'vitest';
import { canonicalOps, digestOps } from '../services/budgetAnalysis/digest.js';

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

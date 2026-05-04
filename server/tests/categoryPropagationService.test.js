import { describe, it, expect } from 'vitest';
import { findSimilarUncategorized, WINDOW_MONTHS } from '../services/categoryPropagationService.js';

const baseOps = [
  { _id: '1', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-04-14', categoryId: null },
  { _id: '2', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-02-04', categoryId: null },
  { _id: '3', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-02-03', categoryId: null },
  { _id: '4', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2025-09-01', categoryId: null },
  { _id: '5', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-08-04', categoryId: null },
  { _id: '6', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-08-15', categoryId: null },
  { _id: 'x', label: 'CARTE MKPAS LYON', bankId: 'b2', date: '2026-04-15', categoryId: null },
  { _id: 'y', label: 'CARTE MKPAS LYON', bankId: 'b1', date: '2026-04-15', categoryId: 'c1' },
];

describe('findSimilarUncategorized — fenêtre temporelle', () => {
  it(`limite à ±${WINDOW_MONTHS} mois autour de la date source`, () => {
    const matches = findSimilarUncategorized(
      baseOps, 'CARTE MKPAS LYON', 'b1', '0', '2026-05-04',
    );
    const ids = matches.map((o) => o._id).sort();
    expect(ids).toEqual(['1', '2', '5']);
  });

  it('ignore les ops d\'une autre banque', () => {
    const matches = findSimilarUncategorized(
      baseOps, 'CARTE MKPAS LYON', 'b1', '0', '2026-05-04',
    );
    expect(matches.find((o) => o._id === 'x')).toBeUndefined();
  });

  it('ignore les ops déjà catégorisées', () => {
    const matches = findSimilarUncategorized(
      baseOps, 'CARTE MKPAS LYON', 'b1', '0', '2026-05-04',
    );
    expect(matches.find((o) => o._id === 'y')).toBeUndefined();
  });

  it('utilise "maintenant" comme référence si pas de date source', () => {
    const now = new Date();
    const recent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString().slice(0, 10);
    const old = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - WINDOW_MONTHS - 1, now.getUTCDate()))
      .toISOString().slice(0, 10);
    const ops = [
      { _id: 'r', label: 'CARTE MKPAS LYON', bankId: 'b1', date: recent, categoryId: null },
      { _id: 'o', label: 'CARTE MKPAS LYON', bankId: 'b1', date: old, categoryId: null },
    ];
    const matches = findSimilarUncategorized(ops, 'CARTE MKPAS LYON', 'b1', null);
    expect(matches.map((o) => o._id)).toEqual(['r']);
  });
});

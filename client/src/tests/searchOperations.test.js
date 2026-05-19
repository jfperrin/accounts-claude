import { describe, it, expect } from 'vitest';
import { parseOperationSearch, matchesOperationAmount } from '../lib/searchOperations';

describe('parseOperationSearch', () => {
  it('renvoie un état vide sur entrée vide', () => {
    expect(parseOperationSearch('')).toEqual({ label: '', amount: null, amountSign: null });
    expect(parseOperationSearch(null)).toEqual({ label: '', amount: null, amountSign: null });
  });

  it('garde un libellé pur si aucun montant', () => {
    expect(parseOperationSearch('carte free prime')).toEqual({
      label: 'carte free prime', amount: null, amountSign: null,
    });
  });

  it('extrait un montant français (virgule)', () => {
    expect(parseOperationSearch('free 1,99')).toEqual({
      label: 'free', amount: 1.99, amountSign: null,
    });
  });

  it('extrait un montant avec point décimal', () => {
    expect(parseOperationSearch('free 1.99')).toEqual({
      label: 'free', amount: 1.99, amountSign: null,
    });
  });

  it("garde l'ordre des tokens du libellé indépendamment de la position du montant", () => {
    expect(parseOperationSearch('1,99 free prime')).toEqual({
      label: 'free prime', amount: 1.99, amountSign: null,
    });
    expect(parseOperationSearch('free 1,99 prime')).toEqual({
      label: 'free prime', amount: 1.99, amountSign: null,
    });
  });

  it("traite le préfixe '-' comme un débit strict", () => {
    expect(parseOperationSearch('-1,99')).toEqual({
      label: '', amount: 1.99, amountSign: 'neg',
    });
  });

  it("traite le préfixe '+' comme un crédit strict", () => {
    expect(parseOperationSearch('+12,50')).toEqual({
      label: '', amount: 12.5, amountSign: 'pos',
    });
  });

  it('ignore le symbole €', () => {
    expect(parseOperationSearch('1,99€')).toEqual({
      label: '', amount: 1.99, amountSign: null,
    });
    expect(parseOperationSearch('€1.99')).toEqual({
      label: '', amount: 1.99, amountSign: null,
    });
  });

  it('garde les entiers sans séparateur comme libellé (évite faux positifs)', () => {
    expect(parseOperationSearch('facture 2024')).toEqual({
      label: 'facture 2024', amount: null, amountSign: null,
    });
  });

  it('ne prend que le premier montant ; les autres restent dans le libellé', () => {
    expect(parseOperationSearch('1,99 2,99')).toEqual({
      label: '2,99', amount: 1.99, amountSign: null,
    });
  });

  it("supporte un montant sans partie entière (',99')", () => {
    expect(parseOperationSearch(',99')).toEqual({
      label: '', amount: 0.99, amountSign: null,
    });
  });
});

describe('matchesOperationAmount', () => {
  const op = (amount) => ({ amount });

  it('passe tout si pas de montant cible', () => {
    expect(matchesOperationAmount(op(-10), null, null)).toBe(true);
  });

  it('match en valeur absolue par défaut', () => {
    expect(matchesOperationAmount(op(-1.99), 1.99, null)).toBe(true);
    expect(matchesOperationAmount(op(1.99), 1.99, null)).toBe(true);
    expect(matchesOperationAmount(op(2), 1.99, null)).toBe(false);
  });

  it("strict débit avec amountSign='neg'", () => {
    expect(matchesOperationAmount(op(-1.99), 1.99, 'neg')).toBe(true);
    expect(matchesOperationAmount(op(1.99), 1.99, 'neg')).toBe(false);
  });

  it("strict crédit avec amountSign='pos'", () => {
    expect(matchesOperationAmount(op(1.99), 1.99, 'pos')).toBe(true);
    expect(matchesOperationAmount(op(-1.99), 1.99, 'pos')).toBe(false);
  });

  it('tolère les imprécisions flottantes (< demi-centime)', () => {
    expect(matchesOperationAmount(op(-1.99 + 0.001), 1.99, 'neg')).toBe(true);
    expect(matchesOperationAmount(op(-1.99 + 0.01), 1.99, 'neg')).toBe(false);
  });

  it('rejette les amount non finis', () => {
    expect(matchesOperationAmount({ amount: 'NaN' }, 1.99, null)).toBe(false);
    expect(matchesOperationAmount(undefined, 1.99, null)).toBe(false);
  });
});

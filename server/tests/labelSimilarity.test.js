import { describe, it, expect } from 'vitest';
import { labelSimilarity } from '../utils/labelSimilarity.js';

const THRESHOLD = 0.8;
const sim = labelSimilarity;

describe('labelSimilarity', () => {
  // ── correspondances attendues (>= 0.8) ──────────────────────────────────
  it('correspondance exacte → 1', () => {
    expect(sim('carte sauvegarde', 'carte sauvegarde')).toBe(1);
  });

  it('chiffres variables dans le libellé (carte)', () => {
    expect(sim('carte 23 0 4 sauvegarde', 'carte 25 0 4 sauvegarde')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('mots supplémentaires insérés (échéance crédit)', () => {
    expect(sim('échéance de crédit', 'échéance 2029 lion de crédit')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('accentuation différente', () => {
    expect(sim('echéance crédit', 'echeance credit')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('casse différente', () => {
    expect(sim('VIREMENT SALAIRE', 'virement salaire')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('même libellé avec code variable en début', () => {
    expect(sim('PRLV 2024001 EDF ENERGIE', 'PRLV 2024012 EDF ENERGIE')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  // ── non-correspondances attendues (< 0.8) ────────────────────────────────
  it('libellés sans rapport → faible score', () => {
    expect(sim('virement salaire', 'prélèvement assurance')).toBeLessThan(THRESHOLD);
  });

  it('un seul mot commun sur deux mots distincts', () => {
    expect(sim('loyer appartement', 'loyer voiture')).toBeLessThan(THRESHOLD);
  });

  it('mot générique bancaire seul ne suffit pas (carte + chiffres variables)', () => {
    expect(sim('carte 21 0 3', 'carte su 69 lion')).toBeLessThan(THRESHOLD);
  });

  it('mot générique seul commun à deux libellés multi-tokens', () => {
    expect(sim('carte fnac', 'carte amazon')).toBeLessThan(THRESHOLD);
    expect(sim('virement salaire', 'virement remboursement')).toBeLessThan(THRESHOLD);
  });

  it('ville commune seule ne suffit pas à matcher des marchands différents', () => {
    expect(sim('CARTE 10/04 SU 69 LYON', 'CARTE 29/04 GREECE 40 LYON 7E')).toBeLessThan(THRESHOLD);
    expect(sim('CARTE 10/04 SU 69 LYON', 'CARTE 16/04 MKPAS LYON')).toBeLessThan(THRESHOLD);
    expect(sim('CARTE 10/04 SU 69 LYON', 'CARTE 28/04 L IMPROBABLE LYON')).toBeLessThan(THRESHOLD);
    expect(sim('CARTE 10/04 SU 69 LYON', 'CARTE 23/04 SAUVEGARDE IMA LYON')).toBeLessThan(THRESHOLD);
  });

  it('même marchand → même match malgré dates variables', () => {
    expect(sim('CARTE 16/04 MKPAS LYON', 'CARTE 14/04 MKPAS LYON')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('libellé manuel mono-token reste reconnu (loyer)', () => {
    expect(sim('Loyer', 'PRLV LOYER MARS')).toBeGreaterThanOrEqual(THRESHOLD);
  });

  it('chaînes vides → 0', () => {
    expect(sim('', 'virement')).toBe(0);
    expect(sim('virement', '')).toBe(0);
  });
});

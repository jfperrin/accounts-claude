import { describe, it, expect } from 'vitest';
import { detectRecurringSuggestions } from '../services/recurringDetectionService.js';

const NOW = '2026-05-15T00:00:00.000Z';

// Fabrique d'opérations pour les tests. Date au format ISO, bankId en string.
function op({ id = '_', label, amount, date, bankId = 'B1', categoryId = null }) {
  return { _id: id, label, amount, date, bankId, categoryId };
}

// Génère N occurrences mensuelles au jour J, en remontant depuis startMonth (1-12) / startYear.
function monthly({ label, amount, day, startMonth, startYear, count, bankId = 'B1', categoryId = null, jitter = 0 }) {
  const ops = [];
  for (let i = 0; i < count; i++) {
    const m = startMonth + i;
    const year = startYear + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12) + 1;
    const d = day + (jitter ? (i % 2 === 0 ? jitter : -jitter) : 0);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00.000Z`;
    ops.push(op({ id: `${label}-${i}`, label, amount, date, bankId, categoryId }));
  }
  return ops;
}

describe('detectRecurringSuggestions', () => {
  it('détecte un loyer mensuel stable', () => {
    const ops = monthly({ label: 'PRLV LOYER', amount: -800, day: 5, startMonth: 1, startYear: 2026, count: 4 });
    const sugg = detectRecurringSuggestions(ops, [], [], { now: NOW });
    expect(sugg).toHaveLength(1);
    expect(sugg[0].label).toBe('PRLV LOYER');
    expect(sugg[0].amount).toBe(-800);
    expect(sugg[0].dayOfMonth).toBe(5);
    expect(sugg[0].bankId).toBe('B1');
    expect(sugg[0].occurrences).toHaveLength(4);
  });

  it('regroupe les libellés ne différant que par des références numériques', () => {
    const ops = [
      op({ id: '1', label: 'PRLV NETFLIX 20260205 REF12', amount: -12, date: '2026-02-05T00:00:00.000Z' }),
      op({ id: '2', label: 'PRLV NETFLIX 20260305 REF13', amount: -12, date: '2026-03-05T00:00:00.000Z' }),
      op({ id: '3', label: 'PRLV NETFLIX 20260405 REF14', amount: -12, date: '2026-04-05T00:00:00.000Z' }),
    ];
    const sugg = detectRecurringSuggestions(ops, [], [], { now: NOW });
    expect(sugg).toHaveLength(1);
    expect(sugg[0].occurrences).toHaveLength(3);
  });

  it('ignore un groupe trop petit', () => {
    const ops = monthly({ label: 'NETFLIX', amount: -12, day: 10, startMonth: 4, startYear: 2026, count: 2 });
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('ignore un groupe sur un seul mois (3 occurrences même mois)', () => {
    const ops = [
      op({ id: '1', label: 'CB FNAC', amount: -20, date: '2026-04-05T00:00:00.000Z' }),
      op({ id: '2', label: 'CB FNAC', amount: -20, date: '2026-04-12T00:00:00.000Z' }),
      op({ id: '3', label: 'CB FNAC', amount: -20, date: '2026-04-20T00:00:00.000Z' }),
    ];
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('ignore un montant trop variable', () => {
    const ops = [
      op({ id: '1', label: 'CB COURSES', amount: -50, date: '2026-02-05T00:00:00.000Z' }),
      op({ id: '2', label: 'CB COURSES', amount: -120, date: '2026-03-05T00:00:00.000Z' }),
      op({ id: '3', label: 'CB COURSES', amount: -200, date: '2026-04-05T00:00:00.000Z' }),
      op({ id: '4', label: 'CB COURSES', amount: -80, date: '2026-05-05T00:00:00.000Z' }),
    ];
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('ignore un jour du mois trop variable', () => {
    const ops = [
      op({ id: '1', label: 'PRLV X', amount: -100, date: '2026-02-02T00:00:00.000Z' }),
      op({ id: '2', label: 'PRLV X', amount: -100, date: '2026-03-15T00:00:00.000Z' }),
      op({ id: '3', label: 'PRLV X', amount: -100, date: '2026-04-28T00:00:00.000Z' }),
    ];
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('tolère ±5 jours de variation', () => {
    const ops = monthly({
      label: 'PRLV ABO', amount: -30, day: 10, startMonth: 2, startYear: 2026, count: 4, jitter: 3,
    });
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(1);
  });

  it('ignore un groupe déjà couvert par une récurrente existante', () => {
    const ops = monthly({ label: 'PRLV LOYER', amount: -800, day: 5, startMonth: 1, startYear: 2026, count: 4 });
    const recurring = [{ label: 'Loyer', amount: -800, dayOfMonth: 5, bankId: 'B1' }];
    expect(detectRecurringSuggestions(ops, recurring, [], { now: NOW })).toHaveLength(0);
  });

  it('ne déclenche pas si la récurrente existante est sur une autre banque', () => {
    const ops = monthly({ label: 'PRLV LOYER', amount: -800, day: 5, startMonth: 1, startYear: 2026, count: 4 });
    const recurring = [{ label: 'Loyer', amount: -800, dayOfMonth: 5, bankId: 'B2' }];
    expect(detectRecurringSuggestions(ops, recurring, [], { now: NOW })).toHaveLength(1);
  });

  it('exclut une suggestion dont la clé est dans dismissedKeys', () => {
    const ops = monthly({ label: 'NETFLIX', amount: -12, day: 10, startMonth: 1, startYear: 2026, count: 4 });
    const dismissed = ['B1|netflix|-12'];
    expect(detectRecurringSuggestions(ops, [], dismissed, { now: NOW })).toHaveLength(0);
  });

  it('split un cluster bimodal en deux récurrences distinctes', () => {
    // Même libellé, deux montants alternés → deux récurrences distinctes
    const ops = [];
    for (let m = 1; m <= 4; m++) {
      const date = `2026-${String(m).padStart(2, '0')}-15T00:00:00.000Z`;
      ops.push(op({ id: `a-${m}`, label: 'PRLV DGFiP', amount: -142, date }));
      ops.push(op({ id: `b-${m}`, label: 'PRLV DGFiP', amount: -18, date }));
    }
    const sugg = detectRecurringSuggestions(ops, [], [], { now: NOW });
    expect(sugg).toHaveLength(2);
    const amounts = sugg.map((s) => s.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([-142, -18]);
    // Clés distinctes pour permettre dismiss indépendant
    expect(sugg[0].key).not.toBe(sugg[1].key);
  });

  it('ne split pas un cluster naturellement bruité', () => {
    const ops = [
      op({ id: '1', label: 'CB COURSES', amount: -16, date: '2026-02-05T00:00:00.000Z' }),
      op({ id: '2', label: 'CB COURSES', amount: -22, date: '2026-02-12T00:00:00.000Z' }),
      op({ id: '3', label: 'CB COURSES', amount: -37, date: '2026-03-05T00:00:00.000Z' }),
      op({ id: '4', label: 'CB COURSES', amount: -25, date: '2026-03-12T00:00:00.000Z' }),
    ];
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('ignore les opérations hors fenêtre (12 mois par défaut)', () => {
    const ops = monthly({ label: 'OLD SUB', amount: -10, day: 5, startMonth: 1, startYear: 2024, count: 4 });
    expect(detectRecurringSuggestions(ops, [], [], { now: NOW })).toHaveLength(0);
  });

  it('attribue la catégorie majoritaire', () => {
    const ops = [
      op({ id: '1', label: 'EDF', amount: -45, date: '2026-02-05T00:00:00.000Z', categoryId: 'cat-energie' }),
      op({ id: '2', label: 'EDF', amount: -45, date: '2026-03-05T00:00:00.000Z', categoryId: 'cat-energie' }),
      op({ id: '3', label: 'EDF', amount: -45, date: '2026-04-05T00:00:00.000Z', categoryId: 'cat-maison' }),
    ];
    const [s] = detectRecurringSuggestions(ops, [], [], { now: NOW });
    expect(s.categoryId).toBe('cat-energie');
  });

  it('ne mélange pas crédit et débit même libellé', () => {
    const ops = [
      op({ id: '1', label: 'PAIE',   amount:  3000, date: '2026-02-28T00:00:00.000Z' }),
      op({ id: '2', label: 'PAIE',   amount:  3000, date: '2026-03-31T00:00:00.000Z' }),
      op({ id: '3', label: 'PAIE',   amount:  3000, date: '2026-04-30T00:00:00.000Z' }),
      op({ id: '4', label: 'PAIE',   amount:  -50, date: '2026-04-30T00:00:00.000Z' }),
    ];
    const sugg = detectRecurringSuggestions(ops, [], [], { now: NOW });
    expect(sugg).toHaveLength(1);
    expect(sugg[0].amount).toBeGreaterThan(0);
  });

  it('renvoie une clé stable indépendante de l\'ordre des opérations', () => {
    const ops1 = monthly({ label: 'NETFLIX', amount: -12, day: 10, startMonth: 1, startYear: 2026, count: 4 });
    const ops2 = [...ops1].reverse();
    const k1 = detectRecurringSuggestions(ops1, [], [], { now: NOW })[0].key;
    const k2 = detectRecurringSuggestions(ops2, [], [], { now: NOW })[0].key;
    expect(k1).toBe(k2);
  });
});

import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { computeHorizon, computeHorizonSparkline } from '../lib/horizon';

const REF_NOW = dayjs('2026-05-19'); // mardi 19 mai 2026

const bank = (id, balance) => ({ _id: id, currentBalance: balance });
const op = ({ id = 'op', date, amount, transferId, bankId = 'b1', label = 'X' }) => ({
  _id: id, date, amount, transferId, bankId, label,
});
const rec = ({ id = 'r', label = 'Loyer', amount = -800, dayOfMonth = 5, bankId = 'b1', toBankId, categoryId = 'c1' }) => ({
  _id: id, label, amount, dayOfMonth, bankId, toBankId, categoryId,
});

describe('computeHorizon — mois passé', () => {
  it('renvoie pastMonth=true quand monthOffset < 0', () => {
    const r = computeHorizon({ monthOffset: -1, endDate: '2026-04-30', now: REF_NOW });
    expect(r).toEqual({ pastMonth: true });
  });
});

describe('computeHorizon — mois courant', () => {
  const baseEnd = '2026-05-31';

  it('actuel seul si pas d\'unpointed ni récurrente', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.pastMonth).toBe(false);
    expect(r.actuel).toBe(1000);
    expect(r.horizon).toBe(1000);
    expect(r.unpointedSum).toBe(0);
    expect(r.recurringRemainingSum).toBe(0);
  });

  it('décrémente le solde avec les unpointed dans la plage', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [
        op({ id: 'u1', date: '2026-05-20', amount: -50 }),
        op({ id: 'u2', date: '2026-05-30', amount: -30 }),
      ],
      recurring: [],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.unpointedSum).toBe(-80);
    expect(r.unpointedCount).toBe(2);
    expect(r.horizon).toBe(920);
  });

  it('ignore les unpointed après EOM', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [op({ id: 'u1', date: '2026-06-05', amount: -200 })],
      recurring: [],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.unpointedSum).toBe(0);
    expect(r.horizon).toBe(1000);
  });

  it('ignore les virements internes', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [op({ id: 'u1', date: '2026-05-20', amount: -500, transferId: 't1' })],
      recurring: [],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.unpointedSum).toBe(0);
    expect(r.horizon).toBe(1000);
  });

  it('compte les récurrentes après aujourd\'hui (mois courant)', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [
        rec({ id: 'r1', dayOfMonth: 25, amount: -800 }),
        rec({ id: 'r2', dayOfMonth: 28, amount: -50 }),
      ],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.recurringRemainingSum).toBe(-850);
    expect(r.recurringRemainingCount).toBe(2);
    expect(r.horizon).toBe(150);
  });

  it('ignore les récurrentes dont la date est déjà passée', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [rec({ dayOfMonth: 5, amount: -800 })], // dayToday = 19
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.recurringRemainingSum).toBe(0);
    expect(r.horizon).toBe(1000);
  });

  it('ignore les récurrentes déjà matérialisées (sameLabel + amount±10%)', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [rec({ label: 'Loyer', dayOfMonth: 25, amount: -800 })],
      operations: [
        op({ id: 'o1', date: '2026-05-10', amount: -805, label: 'Loyer mai 2026', bankId: 'b1' }),
      ],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.recurringRemainingSum).toBe(0);
    expect(r.horizon).toBe(1000);
  });

  it('ignore les récurrentes de virement interne (toBankId)', () => {
    const r = computeHorizon({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [rec({ dayOfMonth: 25, amount: -500, toBankId: 'b2' })],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.recurringRemainingSum).toBe(0);
  });

  it('combine actuel + unpointed + récurrente', () => {
    const r = computeHorizon({
      banks: [bank('b1', 3000), bank('b2', 412)],
      unpointed: [
        op({ id: 'u1', date: '2026-05-20', amount: -150 }),
        op({ id: 'u2', date: '2026-05-28', amount: +500 }),
      ],
      recurring: [
        rec({ id: 'r1', dayOfMonth: 25, amount: -800, label: 'Loyer' }),
      ],
      operations: [],
      monthOffset: 0,
      endDate: baseEnd,
      now: REF_NOW,
    });
    expect(r.actuel).toBe(3412);
    expect(r.unpointedSum).toBe(350);
    expect(r.recurringRemainingSum).toBe(-800);
    expect(r.horizon).toBe(2962);
  });
});

describe('computeHorizon — mois futur', () => {
  it('compte toutes les récurrentes du mois futur (1 mois en avant)', () => {
    const r = computeHorizon({
      banks: [bank('b1', 2000)],
      unpointed: [],
      recurring: [
        rec({ id: 'r1', dayOfMonth: 5, amount: -800, label: 'Loyer' }),
        rec({ id: 'r2', dayOfMonth: 15, amount: 2200, label: 'Salaire' }),
      ],
      operations: [],
      monthOffset: 1,
      endDate: '2026-06-30',
      now: REF_NOW,
    });
    // Mois courant : loyer (dayOfMonth=5 < 19) ignoré, salaire (15 < 19) ignoré.
    // Mois +1 : les deux comptent.
    expect(r.recurringRemainingSum).toBe(1400);
    expect(r.recurringRemainingCount).toBe(2);
    expect(r.horizon).toBe(3400);
  });
});

describe('computeHorizonSparkline', () => {
  it('renvoie un point par jour de today à EOM', () => {
    const points = computeHorizonSparkline({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [],
      operations: [],
      endDate: '2026-05-22',
      now: REF_NOW,
    });
    // 19 → 22 = 4 points
    expect(points).toHaveLength(4);
    expect(points[0]).toEqual({ date: '2026-05-19', value: 1000 });
    expect(points[3]).toEqual({ date: '2026-05-22', value: 1000 });
  });

  it('dernier point égal au horizon', () => {
    const args = {
      banks: [bank('b1', 1000)],
      unpointed: [op({ id: 'u1', date: '2026-05-25', amount: -200 })],
      recurring: [rec({ id: 'r1', dayOfMonth: 28, amount: -50 })],
      operations: [],
      endDate: '2026-05-31',
      now: REF_NOW,
    };
    const horizon = computeHorizon({ ...args, monthOffset: 0 });
    const spark = computeHorizonSparkline(args);
    expect(spark.at(-1).value).toBeCloseTo(horizon.horizon, 2);
  });

  it('opérations passées non pointées s\'appliquent au jour 0', () => {
    const points = computeHorizonSparkline({
      banks: [bank('b1', 1000)],
      unpointed: [op({ id: 'u1', date: '2026-05-10', amount: -100 })],
      recurring: [],
      operations: [],
      endDate: '2026-05-22',
      now: REF_NOW,
    });
    expect(points[0].value).toBe(900);
    expect(points.at(-1).value).toBe(900);
  });

  it('renvoie [] si EOM avant aujourd\'hui', () => {
    const points = computeHorizonSparkline({
      banks: [bank('b1', 1000)],
      unpointed: [],
      recurring: [],
      operations: [],
      endDate: '2026-04-30',
      now: REF_NOW,
    });
    expect(points).toEqual([]);
  });
});

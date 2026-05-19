import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { computeRecurringPreviews } from '../lib/recurringPreview';

const NOW = dayjs('2026-05-19');

const recur = ({ id = 'r1', label = 'Loyer', amount = -800, dayOfMonth = 5, bankId = 'b1', toBankId, categoryId = 'c1' }) => ({
  _id: id, label, amount, dayOfMonth, bankId, toBankId, categoryId,
});

const op = ({ id = 'o', label, amount, date, bankId = 'b1', transferId }) => ({
  _id: id, label, amount, date, bankId, transferId,
});

describe('computeRecurringPreviews', () => {
  it('renvoie une preview pour chaque récurrente non encore matérialisée', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ id: 'r1', label: 'Loyer', dayOfMonth: 5, amount: -800 })],
      operations: [],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 0,
      now: NOW,
    });
    expect(previews).toHaveLength(1);
    expect(previews[0]).toMatchObject({
      label: 'Loyer',
      amount: -800,
      date: '2026-05-05',
      bankLabel: 'BNP',
      isPreview: true,
    });
  });

  it('exclut les récurrentes déjà matérialisées (match exact)', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ label: 'Loyer', dayOfMonth: 5, amount: -800, bankId: 'b1' })],
      operations: [op({ id: 'o1', label: 'Loyer', amount: -800, date: '2026-05-05', bankId: 'b1' })],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 0,
      now: NOW,
    });
    expect(previews).toHaveLength(0);
  });

  it('exclut les récurrentes matchées en fuzzy (label inclus + ±10%)', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ label: 'Loyer', dayOfMonth: 5, amount: -800, bankId: 'b1' })],
      operations: [op({ id: 'o1', label: 'Loyer mai 2026', amount: -805, date: '2026-05-04', bankId: 'b1' })],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 0,
      now: NOW,
    });
    expect(previews).toHaveLength(0);
  });

  it('ignore les récurrentes de virement interne (toBankId)', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ label: 'Virement épargne', amount: -500, toBankId: 'b2' })],
      operations: [],
      banks: [{ _id: 'b1', label: 'BNP' }, { _id: 'b2', label: 'Livret' }],
      monthOffset: 0,
      now: NOW,
    });
    expect(previews).toHaveLength(0);
  });

  it('cale la date sur le dernier jour du mois si dayOfMonth dépasse', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ dayOfMonth: 31, amount: -50, bankId: 'b1' })],
      operations: [],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 1, // juin 2026 = 30 jours
      now: NOW,
    });
    expect(previews).toHaveLength(1);
    expect(previews[0].date).toBe('2026-06-30');
  });

  it('cible le mois sélectionné (monthOffset)', () => {
    const previews = computeRecurringPreviews({
      recurring: [recur({ dayOfMonth: 10, amount: -100, bankId: 'b1' })],
      operations: [],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 2, // juillet
      now: NOW,
    });
    expect(previews[0].date).toBe('2026-07-10');
  });

  it('clé _id stable et unique', () => {
    const previews = computeRecurringPreviews({
      recurring: [
        recur({ id: 'r1', dayOfMonth: 5 }),
        recur({ id: 'r2', dayOfMonth: 15, label: 'Salaire', amount: 2000 }),
      ],
      operations: [],
      banks: [{ _id: 'b1', label: 'BNP' }],
      monthOffset: 0,
      now: NOW,
    });
    expect(previews[0]._id).toBe('preview:r1:2026-05-05');
    expect(previews[1]._id).toBe('preview:r2:2026-05-15');
  });
});

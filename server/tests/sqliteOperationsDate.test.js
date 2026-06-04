import {
  describe, it, expect, beforeAll, beforeEach,
} from 'vitest';
import { randomUUID } from 'node:crypto';

// Le filtre de dates de findByDateRange (SQLite) compare la colonne `date`
// (TEXT) en lexicographique contre start/end.toISOString() (« ...T00:00:00.000Z »).
// Si la date est stockée au format court « YYYY-MM-DD », alors
// 'YYYY-MM-DD' < 'YYYY-MM-DDT00:00:00.000Z' et l'opération datée pile sur la
// borne basse (souvent le 1er du mois sur le dashboard) disparaît. Ces tests
// ciblent directement le repo SQLite (les tests d'intégration tournent sur Mongo,
// qui compare des Date et n'a pas ce bug).

let repos;

beforeAll(async () => {
  process.env.SQLITE_PATH = ':memory:';
  const mod = await import('../db/sqlite.js');
  const createSQLiteRepos = mod.default || mod;
  repos = createSQLiteRepos();
});

let userId; let bankId;
beforeEach(() => {
  userId = repos.users.create({ email: `u-${randomUUID()}@test.local`, passwordHash: 'x', emailVerified: true })._id;
  bankId = repos.banks.create({ label: 'BNP', userId })._id;
});

const juneRange = () => ({
  start: new Date('2026-06-01T00:00:00.000Z'),
  end: new Date('2026-07-01T00:00:00.000Z'), // borne haute exclusive (endDate + 1)
});

describe('SQLite operations.findByDateRange — bornes de date', () => {
  it('inclut une opération datée pile sur startDate (1er du mois)', () => {
    const op = repos.operations.create({
      label: 'Salaire', amount: 2000, date: '2026-06-01', bankId, userId,
    });
    const { start, end } = juneRange();
    const ids = repos.operations.findByDateRange(start, end, userId).map((o) => o._id);
    expect(ids).toContain(op._id);
  });

  it('inclut une opération datée pile sur endDate (dernier jour du mois)', () => {
    const op = repos.operations.create({
      label: 'Loyer', amount: -800, date: '2026-06-30', bankId, userId,
    });
    const { start, end } = juneRange();
    const ids = repos.operations.findByDateRange(start, end, userId).map((o) => o._id);
    expect(ids).toContain(op._id);
  });

  it('exclut une opération hors plage (mois précédent)', () => {
    repos.operations.create({
      label: 'Vieux', amount: -10, date: '2026-05-31', bankId, userId,
    });
    const { start, end } = juneRange();
    const labels = repos.operations.findByDateRange(start, end, userId).map((o) => o.label);
    expect(labels).not.toContain('Vieux');
  });

  it('inclut une opération datée pile sur startDate après update', () => {
    const op = repos.operations.create({
      label: 'Bouge', amount: -20, date: '2026-06-15', bankId, userId,
    });
    repos.operations.update(op._id, userId, { date: '2026-06-01' });
    const { start, end } = juneRange();
    const ids = repos.operations.findByDateRange(start, end, userId).map((o) => o._id);
    expect(ids).toContain(op._id);
  });

  it('inclut une opération horodatée (ISO complet) sur la borne basse', () => {
    const op = repos.operations.create({
      label: 'Achat', amount: -20, date: new Date('2026-06-01T09:30:00.000Z'), bankId, userId,
    });
    const { start, end } = juneRange();
    const ids = repos.operations.findByDateRange(start, end, userId).map((o) => o._id);
    expect(ids).toContain(op._id);
  });

  it('exclut une opération datée du lendemain de endDate (borne haute exclusive)', () => {
    repos.operations.create({
      label: 'Juillet', amount: -10, date: '2026-07-01', bankId, userId,
    });
    const { start, end } = juneRange();
    const labels = repos.operations.findByDateRange(start, end, userId).map((o) => o.label);
    expect(labels).not.toContain('Juillet');
  });
});

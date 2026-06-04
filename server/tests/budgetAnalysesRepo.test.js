import {
  describe, it, expect, beforeAll, beforeEach,
} from 'vitest';
import { randomUUID } from 'node:crypto';

let db;

beforeAll(async () => {
  process.env.SQLITE_PATH = ':memory:';
  const mod = await import('../db/sqlite.js');
  const create = mod.default || mod;
  db = create();
});

let userId;
beforeEach(() => {
  userId = db.users.create({ email: `u-${randomUUID()}@test.local`, passwordHash: 'x' })._id;
});

describe('budgetAnalyses repo (SQLite)', () => {
  it('upsert + findOne renvoient la même donnée', () => {
    db.budgetAnalyses.upsert({
      userId, year: 2026, month: 6,
      opsDigest: 'abc', response: { summary: 'ok' }, model: 'claude-sonnet-4-6',
    });
    const row = db.budgetAnalyses.findOne({ userId, year: 2026, month: 6 });
    expect(row.opsDigest).toBe('abc');
    expect(row.response.summary).toBe('ok');
    expect(row.model).toBe('claude-sonnet-4-6');
    expect(row.updatedAt).toBeTruthy();
  });

  it('upsert remplace une ligne existante', () => {
    db.budgetAnalyses.upsert({ userId, year: 2026, month: 6, opsDigest: 'v1', response: { s: 1 }, model: 'm' });
    db.budgetAnalyses.upsert({ userId, year: 2026, month: 6, opsDigest: 'v2', response: { s: 2 }, model: 'm' });
    const row = db.budgetAnalyses.findOne({ userId, year: 2026, month: 6 });
    expect(row.opsDigest).toBe('v2');
    expect(row.response.s).toBe(2);
  });

  it('findOne retourne null si absent', () => {
    expect(db.budgetAnalyses.findOne({ userId, year: 2025, month: 1 })).toBeNull();
  });
});

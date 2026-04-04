/**
 * Tests du service banks.
 * Vérifie que IS_LOCAL route correctement vers le repository SQLite ou l'API HTTP.
 */
import type { Bank } from '@/types';

// --- mocks déclarés avant tout import du module testé ---
jest.mock('@/db/repositories/banks', () => ({
  getAll:  jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
}));

jest.mock('@/api/banks', () => ({
  getAll:  jest.fn(),
  create:  jest.fn(),
  update:  jest.fn(),
  remove:  jest.fn(),
}));

const MOCK_BANK: Bank = { _id: 'b1', label: 'BNP', userId: 'u1' };

describe('services/banks — mode local (IS_LOCAL = true)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/services/index', () => ({ IS_LOCAL: true }));
  });

  it('getAll() délègue au repository SQLite', async () => {
    const local = require('@/db/repositories/banks');
    local.getAll.mockResolvedValue([MOCK_BANK]);
    const { getAll } = require('@/services/banks');

    const result = await getAll('u1');

    expect(local.getAll).toHaveBeenCalledWith('u1');
    expect(result).toEqual([MOCK_BANK]);
  });

  it('create() délègue au repository SQLite', async () => {
    const local = require('@/db/repositories/banks');
    local.create.mockResolvedValue(MOCK_BANK);
    const { create } = require('@/services/banks');

    const result = await create('BNP', 'u1');

    expect(local.create).toHaveBeenCalledWith('BNP', 'u1');
    expect(result).toEqual(MOCK_BANK);
  });

  it('update() délègue au repository SQLite', async () => {
    const local = require('@/db/repositories/banks');
    local.update.mockResolvedValue({ ...MOCK_BANK, label: 'Société Générale' });
    const { update } = require('@/services/banks');

    await update('b1', 'Société Générale', 'u1');

    expect(local.update).toHaveBeenCalledWith('b1', 'Société Générale');
  });

  it('remove() délègue au repository SQLite', async () => {
    const local = require('@/db/repositories/banks');
    local.remove.mockResolvedValue(undefined);
    const { remove } = require('@/services/banks');

    await remove('b1');

    expect(local.remove).toHaveBeenCalledWith('b1');
  });
});

describe('services/banks — mode remote (IS_LOCAL = false)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/services/index', () => ({ IS_LOCAL: false }));
  });

  it('getAll() délègue à l\'API HTTP', async () => {
    const remote = require('@/api/banks');
    remote.getAll.mockResolvedValue([MOCK_BANK]);
    const { getAll } = require('@/services/banks');

    const result = await getAll('u1');

    expect(remote.getAll).toHaveBeenCalled();
    expect(result).toEqual([MOCK_BANK]);
  });

  it('create() délègue à l\'API HTTP', async () => {
    const remote = require('@/api/banks');
    remote.create.mockResolvedValue(MOCK_BANK);
    const { create } = require('@/services/banks');

    await create('BNP', 'u1');

    expect(remote.create).toHaveBeenCalledWith('BNP');
  });
});

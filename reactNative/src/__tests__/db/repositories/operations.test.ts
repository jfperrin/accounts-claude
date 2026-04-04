/**
 * Tests du repository SQLite operations.
 */

const mockDb = {
  getAllAsync:   jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync:      jest.fn(),
};

jest.mock('@/db/client', () => ({
  getDb:      jest.fn(() => Promise.resolve(mockDb)),
  generateId: jest.fn(() => 'op-id'),
}));

import * as opsRepo from '@/db/repositories/operations';

const DB_ROW = {
  id: 'op-id', label: 'Loyer', amount: -800, date: '2025-01-05T00:00:00.000Z',
  pointed: 0, bank_id: 'b1', period_id: 'p1', user_id: 'u1',
};

beforeEach(() => jest.clearAllMocks());

describe('db/repositories/operations', () => {
  it('getByPeriod() retourne les opérations triées par date', async () => {
    mockDb.getAllAsync.mockResolvedValue([DB_ROW]);

    const result = await opsRepo.getByPeriod('p1');

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM operations WHERE period_id = ? ORDER BY date ASC', ['p1']
    );
    expect(result[0]).toMatchObject({ _id: 'op-id', label: 'Loyer', pointed: false });
  });

  it('create() insère l\'opération avec pointed = false par défaut', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    const result = await opsRepo.create(
      { label: 'Loyer', amount: -800, date: '2025-01-05T00:00:00.000Z', bankId: 'b1', periodId: 'p1' },
      'u1'
    );

    expect(result.pointed).toBe(false);
    expect(result._id).toBe('op-id');
  });

  it('togglePoint() inverse l\'état pointed', async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce(DB_ROW)               // lecture initiale (pointed=0)
      .mockResolvedValueOnce({ ...DB_ROW, pointed: 1 }); // lecture après update
    mockDb.runAsync.mockResolvedValue(undefined);

    const result = await opsRepo.togglePoint('op-id');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE operations SET pointed = ? WHERE id = ?', [1, 'op-id']
    );
    expect(result.pointed).toBe(true);
  });

  it('togglePoint() repasse à false si déjà pointé', async () => {
    const pointedRow = { ...DB_ROW, pointed: 1 };
    mockDb.getFirstAsync
      .mockResolvedValueOnce(pointedRow)
      .mockResolvedValueOnce({ ...pointedRow, pointed: 0 });
    mockDb.runAsync.mockResolvedValue(undefined);

    const result = await opsRepo.togglePoint('op-id');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE operations SET pointed = ? WHERE id = ?', [0, 'op-id']
    );
    expect(result.pointed).toBe(false);
  });

  it('remove() supprime l\'opération', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    await opsRepo.remove('op-id');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM operations WHERE id = ?', ['op-id']
    );
  });
});

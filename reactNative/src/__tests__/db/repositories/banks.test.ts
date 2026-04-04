/**
 * Tests du repository SQLite banks.
 * Le module @/db/client est mocké pour ne pas nécessiter de vrai SQLite.
 */

const mockDb = {
  getAllAsync:  jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync:    jest.fn(),
};

jest.mock('@/db/client', () => ({
  getDb:      jest.fn(() => Promise.resolve(mockDb)),
  generateId: jest.fn(() => 'generated-id'),
}));

import * as banksRepo from '@/db/repositories/banks';

beforeEach(() => jest.clearAllMocks());

describe('db/repositories/banks', () => {
  it('getAll() retourne les banques de l\'utilisateur', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 'b1', label: 'BNP', user_id: 'u1' },
    ]);

    const result = await banksRepo.getAll('u1');

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM banks WHERE user_id = ?', ['u1']
    );
    expect(result).toEqual([{ _id: 'b1', label: 'BNP', userId: 'u1' }]);
  });

  it('getAll() retourne un tableau vide si aucune banque', async () => {
    mockDb.getAllAsync.mockResolvedValue([]);
    expect(await banksRepo.getAll('u1')).toEqual([]);
  });

  it('create() insère une banque et retourne l\'entité', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    const result = await banksRepo.create('Société Générale', 'u1');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'INSERT INTO banks (id, label, user_id) VALUES (?, ?, ?)',
      ['generated-id', 'Société Générale', 'u1']
    );
    expect(result).toEqual({ _id: 'generated-id', label: 'Société Générale', userId: 'u1' });
  });

  it('update() modifie le libellé et retourne la banque mise à jour', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);
    mockDb.getFirstAsync.mockResolvedValue({ id: 'b1', label: 'Crédit Agricole', user_id: 'u1' });

    const result = await banksRepo.update('b1', 'Crédit Agricole');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'UPDATE banks SET label = ? WHERE id = ?', ['Crédit Agricole', 'b1']
    );
    expect(result.label).toBe('Crédit Agricole');
  });

  it('update() lève une erreur si la banque est introuvable', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);
    mockDb.getFirstAsync.mockResolvedValue(null);

    await expect(banksRepo.update('xxx', 'Test')).rejects.toThrow('Bank not found');
  });

  it('remove() supprime la banque', async () => {
    mockDb.runAsync.mockResolvedValue(undefined);

    await banksRepo.remove('b1');

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM banks WHERE id = ?', ['b1']
    );
  });
});

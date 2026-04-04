/**
 * Tests du hook useBanks.
 * Vérifie la gestion d'état (chargement, erreur, mutations optimistes).
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useBanks } from '@/hooks/useBanks';
import type { Bank } from '@/types';

const MOCK_BANKS: Bank[] = [
  { _id: 'b1', label: 'BNP', userId: 'u1' },
  { _id: 'b2', label: 'LCL', userId: 'u1' },
];

jest.mock('@/services/banks', () => ({
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
}));

import * as banksService from '@/services/banks';

beforeEach(() => jest.clearAllMocks());

describe('useBanks', () => {
  it('refresh() charge les banques et désactive le loading', async () => {
    (banksService.getAll as jest.Mock).mockResolvedValue(MOCK_BANKS);

    const { result } = renderHook(() => useBanks('u1'));

    expect(result.current.loading).toBe(false);

    act(() => { result.current.refresh(); });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.banks).toEqual(MOCK_BANKS);
  });

  it('refresh() stocke le message d\'erreur en cas d\'échec', async () => {
    (banksService.getAll as jest.Mock).mockRejectedValue(new Error('Réseau indisponible'));

    const { result } = renderHook(() => useBanks('u1'));
    act(() => { result.current.refresh(); });

    await waitFor(() => expect(result.current.error).toBe('Réseau indisponible'));
    expect(result.current.banks).toEqual([]);
  });

  it('create() ajoute la banque à la liste', async () => {
    (banksService.getAll as jest.Mock).mockResolvedValue(MOCK_BANKS);
    (banksService.create as jest.Mock).mockResolvedValue({ _id: 'b3', label: 'Crédit Agricole', userId: 'u1' });

    const { result } = renderHook(() => useBanks('u1'));
    await act(() => result.current.refresh());

    await act(() => result.current.create('Crédit Agricole'));

    expect(result.current.banks).toHaveLength(3);
    expect(result.current.banks[2].label).toBe('Crédit Agricole');
  });

  it('update() met à jour le libellé dans la liste', async () => {
    (banksService.getAll as jest.Mock).mockResolvedValue(MOCK_BANKS);
    (banksService.update as jest.Mock).mockResolvedValue({ _id: 'b1', label: 'BNP Paribas', userId: 'u1' });

    const { result } = renderHook(() => useBanks('u1'));
    await act(() => result.current.refresh());

    await act(() => result.current.update('b1', 'BNP Paribas'));

    expect(result.current.banks.find(b => b._id === 'b1')?.label).toBe('BNP Paribas');
  });

  it('remove() retire la banque de la liste', async () => {
    (banksService.getAll as jest.Mock).mockResolvedValue(MOCK_BANKS);
    (banksService.remove as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useBanks('u1'));
    await act(() => result.current.refresh());

    await act(() => result.current.remove('b1'));

    expect(result.current.banks).toHaveLength(1);
    expect(result.current.banks[0]._id).toBe('b2');
  });
});

/**
 * Tests du hook useOperations.
 * Couvre le chargement, les mutations et le toggle pointed.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOperations } from '@/hooks/useOperations';
import type { Operation } from '@/types';

const OP: Operation = {
  _id: 'op1', label: 'Loyer', amount: -800, date: '2025-01-05T00:00:00Z',
  pointed: false, bankId: 'b1', periodId: 'p1', userId: 'u1',
};

jest.mock('@/services/operations', () => ({
  getByPeriod:     jest.fn(),
  create:          jest.fn(),
  update:          jest.fn(),
  remove:          jest.fn(),
  togglePoint:     jest.fn(),
  importRecurring: jest.fn(),
}));

import * as opsService from '@/services/operations';

beforeEach(() => jest.clearAllMocks());

describe('useOperations', () => {
  it('refresh() charge les opérations d\'une période', async () => {
    (opsService.getByPeriod as jest.Mock).mockResolvedValue([OP]);

    const { result } = renderHook(() => useOperations('u1'));
    await act(() => result.current.refresh('p1'));

    expect(result.current.operations).toEqual([OP]);
  });

  it('create() ajoute une opération à la liste', async () => {
    (opsService.getByPeriod as jest.Mock).mockResolvedValue([]);
    const newOp = { ...OP, _id: 'op2', label: 'Salaire', amount: 2500 };
    (opsService.create as jest.Mock).mockResolvedValue(newOp);

    const { result } = renderHook(() => useOperations('u1'));
    await act(() => result.current.refresh('p1'));
    await act(() => result.current.create({
      label: 'Salaire', amount: 2500, date: '2025-01-01T00:00:00Z', bankId: 'b1', periodId: 'p1',
    }));

    expect(result.current.operations).toHaveLength(1);
    expect(result.current.operations[0].label).toBe('Salaire');
  });

  it('togglePoint() met à jour l\'état pointed dans la liste', async () => {
    (opsService.getByPeriod as jest.Mock).mockResolvedValue([OP]);
    (opsService.togglePoint as jest.Mock).mockResolvedValue({ ...OP, pointed: true });

    const { result } = renderHook(() => useOperations('u1'));
    await act(() => result.current.refresh('p1'));
    await act(() => result.current.togglePoint('op1'));

    expect(result.current.operations[0].pointed).toBe(true);
  });

  it('remove() retire l\'opération de la liste', async () => {
    (opsService.getByPeriod as jest.Mock).mockResolvedValue([OP]);
    (opsService.remove as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useOperations('u1'));
    await act(() => result.current.refresh('p1'));
    await act(() => result.current.remove('op1'));

    expect(result.current.operations).toHaveLength(0);
  });
});

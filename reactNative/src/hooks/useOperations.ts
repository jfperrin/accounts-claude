import { useState, useCallback } from 'react';
import * as opsService from '@/services/operations';
import type { Operation, Bank, RecurringOperation } from '@/types';

export function useOperations(userId: string) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading,    setLoading]    = useState(false);

  const refresh = useCallback(async (periodId: string) => {
    setLoading(true);
    try {
      setOperations(await opsService.getByPeriod(periodId));
    } finally {
      setLoading(false);
    }
  }, []);

  const create = async (
    data: Pick<Operation, 'label' | 'amount' | 'date' | 'bankId' | 'periodId'>
  ) => {
    const op = await opsService.create(data, userId);
    setOperations((prev) => [...prev, op]);
    return op;
  };

  const update = async (
    id: string,
    data: Partial<Pick<Operation, 'label' | 'amount' | 'date' | 'bankId'>>
  ) => {
    const op = await opsService.update(id, data);
    setOperations((prev) => prev.map((o) => (o._id === id ? op : o)));
    return op;
  };

  const remove = async (id: string) => {
    await opsService.remove(id);
    setOperations((prev) => prev.filter((o) => o._id !== id));
  };

  const togglePoint = async (id: string) => {
    const op = await opsService.togglePoint(id);
    setOperations((prev) => prev.map((o) => (o._id === id ? op : o)));
  };

  const importRecurring = async (
    periodId: string,
    recurring: RecurringOperation[],
    month: number,
    year: number,
  ) => {
    const payload = recurring.map((r) => ({
      label:      r.label,
      amount:     r.amount,
      dayOfMonth: r.dayOfMonth,
      bankId:     (r.bankId as Bank)?._id ?? (r.bankId as string),
    }));
    const ops = await opsService.importRecurring(periodId, payload, month, year, userId);
    setOperations((prev) => [...prev, ...ops]);
    return ops;
  };

  return { operations, loading, refresh, create, update, remove, togglePoint, importRecurring };
}

import { useState, useCallback } from 'react';
import * as service from '@/services/recurringOperations';
import type { RecurringOperation } from '@/types';

export function useRecurring(userId: string) {
  const [items,   setItems]   = useState<RecurringOperation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await service.getAll(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const create = async (data: Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>) => {
    const item = await service.create(data, userId);
    setItems((prev) => [...prev, item]);
    return item;
  };

  const update = async (
    id: string,
    data: Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>
  ) => {
    const item = await service.update(id, data, userId);
    setItems((prev) => prev.map((i) => (i._id === id ? item : i)));
    return item;
  };

  const remove = async (id: string) => {
    await service.remove(id);
    setItems((prev) => prev.filter((i) => i._id !== id));
  };

  return { items, loading, refresh, create, update, remove };
}

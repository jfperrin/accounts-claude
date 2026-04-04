import { useState, useCallback } from 'react';
import * as periodsService from '@/services/periods';
import type { Period } from '@/types';

export function usePeriods(userId: string) {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await periodsService.getAll(userId));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getOrCreate = async (month: number, year: number): Promise<Period> => {
    const period = await periodsService.getOrCreate(month, year, userId);
    setPeriods((prev) => {
      const exists = prev.find((p) => p._id === period._id);
      return exists ? prev : [period, ...prev];
    });
    return period;
  };

  const saveBalances = async (id: string, balances: Record<string, number>): Promise<Period> => {
    const updated = await periodsService.saveBalances(id, balances);
    setPeriods((prev) => prev.map((p) => (p._id === id ? updated : p)));
    return updated;
  };

  return { periods, loading, refresh, getOrCreate, saveBalances };
}

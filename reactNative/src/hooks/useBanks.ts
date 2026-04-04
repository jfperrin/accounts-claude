import { useState, useCallback } from 'react';
import * as banksService from '../services/banks';
import type { Bank } from '../types';

export function useBanks(userId: string) {
  const [banks,   setBanks]   = useState<Bank[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBanks(await banksService.getAll(userId));
    } catch (e: any) {
      setError(e?.message ?? 'Error loading banks');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const create = async (label: string) => {
    const bank = await banksService.create(label, userId);
    setBanks((prev) => [...prev, bank]);
    return bank;
  };

  const update = async (id: string, label: string) => {
    const bank = await banksService.update(id, label, userId);
    setBanks((prev) => prev.map((b) => (b._id === id ? bank : b)));
    return bank;
  };

  const remove = async (id: string) => {
    await banksService.remove(id);
    setBanks((prev) => prev.filter((b) => b._id !== id));
  };

  return { banks, loading, error, refresh, create, update, remove };
}

import { apiClient } from './client';
import type { Period } from '@/types';

export const getAll        = (): Promise<Period[]>              => apiClient.get('/periods');
export const create        = (month: number, year: number): Promise<Period> =>
  apiClient.post('/periods', { month, year });
export const remove        = (id: string): Promise<void>        => apiClient.delete(`/periods/${id}`);
export const saveBalances  = (id: string, balances: Record<string, number>): Promise<Period> =>
  apiClient.patch(`/periods/${id}/balances`, { balances });

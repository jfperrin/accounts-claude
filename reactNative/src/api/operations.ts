import { apiClient } from './client';
import type { Operation } from '@/types';

export const getByPeriod    = (periodId: string): Promise<Operation[]> =>
  apiClient.get('/operations', { params: { periodId } });

export const create         = (data: Omit<Operation, '_id' | 'userId' | 'pointed'>): Promise<Operation> =>
  apiClient.post('/operations', data);

export const update         = (id: string, data: Partial<Operation>): Promise<Operation> =>
  apiClient.put(`/operations/${id}`, data);

export const remove         = (id: string): Promise<void> =>
  apiClient.delete(`/operations/${id}`);

export const togglePoint    = (id: string): Promise<Operation> =>
  apiClient.patch(`/operations/${id}/point`);

export const importRecurring = (periodId: string): Promise<Operation[]> =>
  apiClient.post('/operations/import-recurring', { periodId });

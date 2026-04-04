import { apiClient } from './client';
import type { RecurringOperation } from '../types';

type Payload = Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>;

export const getAll  = (): Promise<RecurringOperation[]>                  => apiClient.get('/recurring-operations');
export const create  = (data: Payload): Promise<RecurringOperation>       => apiClient.post('/recurring-operations', data);
export const update  = (id: string, data: Payload): Promise<RecurringOperation> =>
  apiClient.put(`/recurring-operations/${id}`, data);
export const remove  = (id: string): Promise<void>                        => apiClient.delete(`/recurring-operations/${id}`);

import { apiClient } from './client';
import type { Bank } from '../types';

export const getAll    = (): Promise<Bank[]>                       => apiClient.get('/banks');
export const create    = (label: string): Promise<Bank>            => apiClient.post('/banks', { label });
export const update    = (id: string, label: string): Promise<Bank>=> apiClient.put(`/banks/${id}`, { label });
export const remove    = (id: string): Promise<void>               => apiClient.delete(`/banks/${id}`);

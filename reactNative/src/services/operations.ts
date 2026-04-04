import { IS_LOCAL } from './index';
import * as local  from '../db/repositories/operations';
import * as remote from '../api/operations';
import type { Operation } from '../types';

type CreatePayload = Pick<Operation, 'label' | 'amount' | 'date' | 'bankId' | 'periodId'>;

export async function getByPeriod(periodId: string): Promise<Operation[]> {
  return IS_LOCAL ? local.getByPeriod(periodId) : remote.getByPeriod(periodId);
}

export async function create(data: CreatePayload, userId: string): Promise<Operation> {
  return IS_LOCAL ? local.create(data, userId) : remote.create(data);
}

export async function update(id: string, data: Partial<Pick<Operation, 'label' | 'amount' | 'date' | 'bankId'>>): Promise<Operation> {
  return IS_LOCAL ? local.update(id, data) : remote.update(id, data);
}

export async function remove(id: string): Promise<void> {
  return IS_LOCAL ? local.remove(id) : remote.remove(id);
}

export async function togglePoint(id: string): Promise<Operation> {
  return IS_LOCAL ? local.togglePoint(id) : remote.togglePoint(id);
}

export async function importRecurring(
  periodId: string,
  recurring: Array<{ label: string; amount: number; dayOfMonth: number; bankId: string }>,
  month: number,
  year: number,
  userId: string,
): Promise<Operation[]> {
  if (IS_LOCAL) return local.importRecurring(periodId, recurring, month, year, userId);
  return remote.importRecurring(periodId);
}

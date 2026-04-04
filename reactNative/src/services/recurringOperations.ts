import { IS_LOCAL } from './index';
import * as local  from '@/db/repositories/recurringOperations';
import * as remote from '@/api/recurringOperations';
import type { RecurringOperation } from '@/types';

type Payload = Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>;

export async function getAll(userId: string): Promise<RecurringOperation[]> {
  return IS_LOCAL ? local.getAll(userId) : remote.getAll();
}

export async function create(data: Payload, userId: string): Promise<RecurringOperation> {
  return IS_LOCAL ? local.create(data, userId) : remote.create(data);
}

export async function update(id: string, data: Payload, _userId: string): Promise<RecurringOperation> {
  return IS_LOCAL ? local.update(id, data) : remote.update(id, data);
}

export async function remove(id: string): Promise<void> {
  return IS_LOCAL ? local.remove(id) : remote.remove(id);
}

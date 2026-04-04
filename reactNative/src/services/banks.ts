import { IS_LOCAL } from './index';
import * as local  from '../db/repositories/banks';
import * as remote from '../api/banks';
import type { Bank } from '../types';

export async function getAll(userId: string): Promise<Bank[]> {
  return IS_LOCAL ? local.getAll(userId) : remote.getAll();
}

export async function create(label: string, userId: string): Promise<Bank> {
  return IS_LOCAL ? local.create(label, userId) : remote.create(label);
}

export async function update(id: string, label: string, _userId: string): Promise<Bank> {
  return IS_LOCAL ? local.update(id, label) : remote.update(id, label);
}

export async function remove(id: string): Promise<void> {
  return IS_LOCAL ? local.remove(id) : remote.remove(id);
}

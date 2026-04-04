import { IS_LOCAL } from './index';
import * as local  from '../db/repositories/periods';
import * as remote from '../api/periods';
import type { Period } from '../types';

export async function getAll(userId: string): Promise<Period[]> {
  return IS_LOCAL ? local.getAll(userId) : remote.getAll();
}

export async function getOrCreate(month: number, year: number, userId: string): Promise<Period> {
  if (IS_LOCAL) return local.getOrCreate(month, year, userId);
  const periods = await remote.getAll();
  const found   = periods.find((p) => p.month === month && p.year === year);
  return found ?? remote.create(month, year);
}

export async function saveBalances(id: string, balances: Record<string, number>): Promise<Period> {
  return IS_LOCAL ? local.saveBalances(id, balances) : remote.saveBalances(id, balances);
}

export async function remove(id: string): Promise<void> {
  return IS_LOCAL ? local.remove(id) : remote.remove(id);
}

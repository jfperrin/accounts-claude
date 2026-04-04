import { getDb, generateId } from '../client';
import type { Bank } from '../../types';

interface DbBank { id: string; label: string; user_id: string }

const toBank = (r: DbBank): Bank => ({ _id: r.id, label: r.label, userId: r.user_id });

export async function getAll(userId: string): Promise<Bank[]> {
  const db   = await getDb();
  const rows = await db.getAllAsync<DbBank>('SELECT * FROM banks WHERE user_id = ?', [userId]);
  return rows.map(toBank);
}

export async function create(label: string, userId: string): Promise<Bank> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync('INSERT INTO banks (id, label, user_id) VALUES (?, ?, ?)', [id, label, userId]);
  return { _id: id, label, userId };
}

export async function update(id: string, label: string): Promise<Bank> {
  const db = await getDb();
  await db.runAsync('UPDATE banks SET label = ? WHERE id = ?', [label, id]);
  const row = await db.getFirstAsync<DbBank>('SELECT * FROM banks WHERE id = ?', [id]);
  if (!row) throw new Error('Bank not found');
  return toBank(row);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM banks WHERE id = ?', [id]);
}

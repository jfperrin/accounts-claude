import { getDb, generateId } from '../client';
import type { Period } from '../../types';

interface DbPeriod { id: string; month: number; year: number; balances: string; user_id: string }

const toPeriod = (r: DbPeriod): Period => ({
  _id:      r.id,
  month:    r.month,
  year:     r.year,
  balances: JSON.parse(r.balances),
  userId:   r.user_id,
});

export async function getAll(userId: string): Promise<Period[]> {
  const db   = await getDb();
  const rows = await db.getAllAsync<DbPeriod>(
    'SELECT * FROM periods WHERE user_id = ? ORDER BY year DESC, month DESC', [userId]
  );
  return rows.map(toPeriod);
}

export async function getOrCreate(month: number, year: number, userId: string): Promise<Period> {
  const db  = await getDb();
  const row = await db.getFirstAsync<DbPeriod>(
    'SELECT * FROM periods WHERE month = ? AND year = ? AND user_id = ?', [month, year, userId]
  );
  if (row) return toPeriod(row);

  const id = generateId();
  await db.runAsync(
    'INSERT INTO periods (id, month, year, balances, user_id) VALUES (?, ?, ?, ?, ?)',
    [id, month, year, '{}', userId]
  );
  return { _id: id, month, year, balances: {}, userId };
}

export async function saveBalances(id: string, balances: Record<string, number>): Promise<Period> {
  const db = await getDb();
  await db.runAsync('UPDATE periods SET balances = ? WHERE id = ?', [JSON.stringify(balances), id]);
  const row = await db.getFirstAsync<DbPeriod>('SELECT * FROM periods WHERE id = ?', [id]);
  if (!row) throw new Error('Period not found');
  return toPeriod(row);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM periods WHERE id = ?', [id]);
}

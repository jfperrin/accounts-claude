import { getDb, generateId } from '@/db/client';
import type { Operation } from '@/types';

interface DbOperation {
  id: string; label: string; amount: number; date: string;
  pointed: number; bank_id: string; period_id: string; user_id: string;
}

const toOp = (r: DbOperation): Operation => ({
  _id:      r.id,
  label:    r.label,
  amount:   r.amount,
  date:     r.date,
  pointed:  r.pointed === 1,
  bankId:   r.bank_id,
  periodId: r.period_id,
  userId:   r.user_id,
});

export async function getByPeriod(periodId: string): Promise<Operation[]> {
  const db   = await getDb();
  const rows = await db.getAllAsync<DbOperation>(
    'SELECT * FROM operations WHERE period_id = ? ORDER BY date ASC', [periodId]
  );
  return rows.map(toOp);
}

export async function create(
  data: Pick<Operation, 'label' | 'amount' | 'date' | 'bankId' | 'periodId'>,
  userId: string,
): Promise<Operation> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO operations (id, label, amount, date, pointed, bank_id, period_id, user_id) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    [id, data.label, data.amount, data.date, data.bankId as string, data.periodId, userId]
  );
  return { _id: id, pointed: false, userId, ...data, bankId: data.bankId as string };
}

export async function update(id: string, data: Partial<Pick<Operation, 'label' | 'amount' | 'date' | 'bankId'>>): Promise<Operation> {
  const db = await getDb();
  const fields = Object.entries(data)
    .map(([k]) => `${k === 'bankId' ? 'bank_id' : k} = ?`)
    .join(', ');
  const values = Object.values(data);
  await db.runAsync(`UPDATE operations SET ${fields} WHERE id = ?`, [...values, id]);
  const row = await db.getFirstAsync<DbOperation>('SELECT * FROM operations WHERE id = ?', [id]);
  if (!row) throw new Error('Operation not found');
  return toOp(row);
}

export async function togglePoint(id: string): Promise<Operation> {
  const db  = await getDb();
  const row = await db.getFirstAsync<DbOperation>('SELECT * FROM operations WHERE id = ?', [id]);
  if (!row) throw new Error('Operation not found');
  await db.runAsync('UPDATE operations SET pointed = ? WHERE id = ?', [row.pointed === 1 ? 0 : 1, id]);
  return toOp({ ...row, pointed: row.pointed === 1 ? 0 : 1 });
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM operations WHERE id = ?', [id]);
}

export async function importRecurring(
  periodId: string,
  recurring: Array<{ label: string; amount: number; dayOfMonth: number; bankId: string }>,
  month: number,
  year: number,
  userId: string,
): Promise<Operation[]> {
  const existing = await getByPeriod(periodId);
  const keys     = new Set(existing.map((o) => `${o.label}|${o.bankId}|${o.amount}`));

  const toInsert = recurring.filter(
    (r) => !keys.has(`${r.label}|${r.bankId}|${r.amount}`)
  );

  const results: Operation[] = [];
  for (const r of toInsert) {
    const day  = Math.min(r.dayOfMonth, new Date(year, month, 0).getDate());
    const date = new Date(year, month - 1, day).toISOString();
    const op   = await create({ label: r.label, amount: r.amount, date, bankId: r.bankId, periodId }, userId);
    results.push(op);
  }
  return results;
}

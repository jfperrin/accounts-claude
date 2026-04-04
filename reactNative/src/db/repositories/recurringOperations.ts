import { getDb, generateId } from '../client';
import type { RecurringOperation } from '../../types';

interface DbRecurring {
  id: string; label: string; amount: number;
  day_of_month: number; bank_id: string; user_id: string;
}

const toRecurring = (r: DbRecurring): RecurringOperation => ({
  _id:         r.id,
  label:       r.label,
  amount:      r.amount,
  dayOfMonth:  r.day_of_month,
  bankId:      r.bank_id,
  userId:      r.user_id,
});

export async function getAll(userId: string): Promise<RecurringOperation[]> {
  const db   = await getDb();
  const rows = await db.getAllAsync<DbRecurring>(
    'SELECT * FROM recurring_operations WHERE user_id = ?', [userId]
  );
  return rows.map(toRecurring);
}

export async function create(
  data: Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>,
  userId: string,
): Promise<RecurringOperation> {
  const db = await getDb();
  const id = generateId();
  await db.runAsync(
    'INSERT INTO recurring_operations (id, label, amount, day_of_month, bank_id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [id, data.label, data.amount, data.dayOfMonth, data.bankId as string, userId]
  );
  return { _id: id, userId, ...data, bankId: data.bankId as string };
}

export async function update(
  id: string,
  data: Pick<RecurringOperation, 'label' | 'amount' | 'dayOfMonth' | 'bankId'>,
): Promise<RecurringOperation> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE recurring_operations SET label = ?, amount = ?, day_of_month = ?, bank_id = ? WHERE id = ?',
    [data.label, data.amount, data.dayOfMonth, data.bankId as string, id]
  );
  const row = await db.getFirstAsync<DbRecurring>(
    'SELECT * FROM recurring_operations WHERE id = ?', [id]
  );
  if (!row) throw new Error('Recurring operation not found');
  return toRecurring(row);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM recurring_operations WHERE id = ?', [id]);
}

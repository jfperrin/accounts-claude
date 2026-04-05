import bcrypt from 'bcryptjs';
import * as SecureStore from 'expo-secure-store';
import { getDb, generateId } from '@/db/client';
import type { User, AuthCredentials } from '@/types';

const SESSION_KEY = 'local_user_id';

interface DbUser { id: string; username: string; password_hash: string }

export async function register({ username, password }: AuthCredentials): Promise<User> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DbUser>(
    'SELECT id FROM users WHERE username = ?', [username]
  );
  if (existing) throw new Error('Username already taken');

  const id   = generateId();
  const hash = await bcrypt.hash(password, 10);
  await db.runAsync(
    'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
    [id, username, hash]
  );
  await SecureStore.setItemAsync(SESSION_KEY, id);
  return { _id: id, username };
}

export async function login({ username, password }: AuthCredentials): Promise<User> {
  const db   = await getDb();
  const user = await db.getFirstAsync<DbUser>(
    'SELECT * FROM users WHERE username = ?', [username]
  );
  if (!user) throw new Error('Invalid credentials');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error('Invalid credentials');

  await SecureStore.setItemAsync(SESSION_KEY, user.id);
  return { _id: user.id, username: user.username };
}

export async function me(): Promise<User | null> {
  const id = await SecureStore.getItemAsync(SESSION_KEY);
  if (!id) return null;
  const db   = await getDb();
  const user = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) return null;
  return { _id: user.id, username: user.username };
}

export async function logout(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

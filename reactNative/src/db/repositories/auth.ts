import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDb, generateId } from '../client';
import type { User, AuthCredentials } from '../../types';

const SESSION_KEY = 'local_user_id';

async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

interface DbUser { id: string; username: string; password_hash: string }

export async function register({ username, password }: AuthCredentials): Promise<User> {
  const db = await getDb();
  const existing = await db.getFirstAsync<DbUser>(
    'SELECT id FROM users WHERE username = ?', [username]
  );
  if (existing) throw new Error('Username already taken');

  const id   = generateId();
  const hash = await hashPassword(password);
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

  const hash = await hashPassword(password);
  if (hash !== user.password_hash) throw new Error('Invalid credentials');

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

import * as FileSystem from 'expo-file-system';
import { getDb } from '@/db/client';
import type { User } from '@/types';

interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
}

function mapUser(row: DbUser): User {
  return {
    _id:       row.id,
    username:  row.username,
    title:     row.title      ?? null,
    firstName: row.first_name ?? null,
    lastName:  row.last_name  ?? null,
    nickname:  row.nickname   ?? null,
    avatarUrl: row.avatar_url ?? null,
  };
}

export async function updateProfile(
  userId: string,
  data: { title: string | null; firstName: string | null; lastName: string | null; nickname: string | null }
): Promise<User> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE users SET title=?, first_name=?, last_name=?, nickname=? WHERE id=?',
    [data.title, data.firstName, data.lastName, data.nickname, userId]
  );
  const row = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id=?', [userId]);
  if (!row) throw new Error('User not found');
  return mapUser(row);
}

export async function updateAvatar(userId: string, imageUri: string): Promise<User> {
  const dest = `${FileSystem.documentDirectory}avatars/${userId}.jpg`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}avatars`, { intermediates: true });
  await FileSystem.copyAsync({ from: imageUri, to: dest });

  const db = await getDb();
  await db.runAsync('UPDATE users SET avatar_url=? WHERE id=?', [dest, userId]);
  const row = await db.getFirstAsync<DbUser>('SELECT * FROM users WHERE id=?', [userId]);
  if (!row) throw new Error('User not found');
  return mapUser(row);
}

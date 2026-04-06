import type { SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS banks (
      id      TEXT PRIMARY KEY,
      label   TEXT NOT NULL,
      user_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS periods (
      id       TEXT PRIMARY KEY,
      month    INTEGER NOT NULL,
      year     INTEGER NOT NULL,
      balances TEXT NOT NULL DEFAULT '{}',
      user_id  TEXT NOT NULL,
      UNIQUE(month, year, user_id)
    );

    CREATE TABLE IF NOT EXISTS operations (
      id        TEXT PRIMARY KEY,
      label     TEXT NOT NULL,
      amount    REAL NOT NULL,
      date      TEXT NOT NULL,
      pointed   INTEGER NOT NULL DEFAULT 0,
      bank_id   TEXT NOT NULL,
      period_id TEXT NOT NULL,
      user_id   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_operations (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      amount       REAL NOT NULL,
      day_of_month INTEGER NOT NULL,
      bank_id      TEXT NOT NULL,
      user_id      TEXT NOT NULL
    );
  `);

  // Profile columns — idempotent: silently ignored if column already exists
  const profileColumns: [string, string][] = [
    ['title',      'TEXT'],
    ['first_name', 'TEXT'],
    ['last_name',  'TEXT'],
    ['nickname',   'TEXT'],
    ['avatar_url', 'TEXT'],
  ];
  for (const [col, type] of profileColumns) {
    try {
      await db.runAsync(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
    } catch (_) {
      // column already exists — safe to ignore
    }
  }
}

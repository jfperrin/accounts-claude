import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';

/** Singleton : une seule connexion SQLite par session applicative. */
let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Retourne la connexion SQLite, en l'ouvrant et en exécutant les migrations si nécessaire.
 * À appeler au début de chaque fonction de repository.
 */
export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('accounts.db');
  await runMigrations(_db);
  return _db;
}

/**
 * Génère un identifiant unique sous la forme `<timestamp base36><random>`.
 * Utilisé comme clé primaire dans toutes les tables SQLite (équivalent ObjectId Mongo).
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

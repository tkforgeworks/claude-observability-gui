import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { runMigrations } from './migrations';

const DB_DIR_NAME = 'ClaudeUsageMonitor';
const DB_FILE_NAME = 'usage.db';

let _db: Database.Database | null = null;

/**
 * Returns the path where the database will be stored.
 * Uses Electron's userData directory (%APPDATA%\ClaudeUsageMonitor\usage.db).
 * @see §3 of architecture doc
 */
export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, DB_DIR_NAME, DB_FILE_NAME);
}

/**
 * Initialises the SQLite connection. Creates the database directory and file
 * if they do not exist, enables WAL mode, and runs all pending migrations.
 *
 * Must be called once from the Electron main process before any IPC handlers
 * attempt to use the database.
 *
 * @see §3 "WAL mode" and "Schema Migration System" in architecture doc
 */
export function initDatabase(): Database.Database {
  if (_db) {
    return _db;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // Ensure the directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[database] Created directory: ${dbDir}`);
  }

  console.log(`[database] Opening database at: ${dbPath}`);

  _db = new BetterSqlite3(dbPath, {
    // verbose: console.log, // Uncomment for SQL query logging during development
  });

  // Enable WAL mode to prevent corruption on crash
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // Run all pending migrations
  runMigrations(_db);

  console.log('[database] Initialised successfully');
  return _db;
}

/**
 * Returns the active database connection. Throws if initDatabase() has not
 * been called yet.
 */
export function getDatabase(): Database.Database {
  if (!_db) {
    throw new Error(
      '[database] Database not initialised. Call initDatabase() first.'
    );
  }
  return _db;
}

/**
 * Closes the database connection. Should be called on app quit.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close();
    _db = null;
    console.log('[database] Connection closed');
  }
}

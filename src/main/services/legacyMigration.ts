/**
 * One-time userData migration for the CGUI-54 rebrand.
 *
 * 2.0.0 renamed the package identity from `claude-usage-monitor` to
 * `tkforgeworks-cog`, which moves Electron's userData root, and the config
 * subdirectory from `ClaudeUsageMonitor` to `COG`. A machine upgrading from
 * any pre-rebrand version (1.x) has its database and config at the old path
 * and would otherwise start empty. This runs once per missing file on
 * startup, before anything consumes userData.
 *
 * Copy, never move: the old directory is left in place as a safety net (and
 * the old app may still be installed alongside on Windows, where NSIS treats
 * the renamed product as a separate install).
 *
 * The database is snapshotted with `VACUUM INTO` from a read-only
 * connection, which produces a consistent copy even if a pre-rebrand app
 * instance is running with pending WAL content; plain file copy of
 * db+wal+shm is the fallback.
 */

import { app } from 'electron';
import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { isManagedEntry, MANAGED_KEY } from './launchOnStartup';

/** Old identity (pre-CGUI-54). Historical constants — never rename these. */
const LEGACY_USERDATA_ROOT = 'claude-usage-monitor';
const LEGACY_CONFIG_DIR = 'ClaudeUsageMonitor';
const LEGACY_AUTOSTART_FILE = 'claude-usage-monitor.desktop';

const CONFIG_FILES = ['settings.json', 'dashboard.json'];
const DB_FILE = 'usage.db';

export interface MigrationResult {
  migrated: string[];
  skipped: string[];
  errors: string[];
}

/**
 * Copies legacy data from `oldDir` into `newDir`. Per-file and idempotent:
 * a file is copied only when it exists in the old location and not in the
 * new one, so a partially-migrated or already-populated install is never
 * overwritten. Exported for tests; production callers use
 * `migrateLegacyUserData()`.
 */
export function migrateLegacyDataDir(oldDir: string, newDir: string): MigrationResult {
  const result: MigrationResult = { migrated: [], skipped: [], errors: [] };
  if (!fs.existsSync(oldDir)) return result;

  fs.mkdirSync(newDir, { recursive: true });

  for (const file of CONFIG_FILES) {
    const src = path.join(oldDir, file);
    const dest = path.join(newDir, file);
    try {
      if (!fs.existsSync(src)) continue;
      if (fs.existsSync(dest)) {
        result.skipped.push(file);
        continue;
      }
      fs.copyFileSync(src, dest);
      result.migrated.push(file);
    } catch (err) {
      result.errors.push(`${file}: ${err}`);
    }
  }

  const srcDb = path.join(oldDir, DB_FILE);
  const destDb = path.join(newDir, DB_FILE);
  if (fs.existsSync(srcDb)) {
    if (fs.existsSync(destDb)) {
      result.skipped.push(DB_FILE);
    } else {
      try {
        snapshotDatabase(srcDb, destDb);
        result.migrated.push(DB_FILE);
      } catch (err) {
        result.errors.push(`${DB_FILE}: ${err}`);
      }
    }
  }

  return result;
}

/**
 * Consistent DB snapshot: VACUUM INTO takes a read snapshot, so it is safe
 * against a concurrently running pre-rebrand app and folds any WAL content
 * in. Falls back to copying db+wal+shm files directly when SQLite refuses
 * (locked exclusively, unreadable header, ...).
 */
function snapshotDatabase(srcDb: string, destDb: string): void {
  try {
    const db = new BetterSqlite3(srcDb, { readonly: true, fileMustExist: true });
    try {
      // VACUUM INTO takes a filename literal; single quotes are escaped by doubling
      db.exec(`VACUUM INTO '${destDb.replace(/'/g, "''")}'`);
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn(`[legacyMigration] VACUUM INTO failed (${err}); falling back to file copy`);
    fs.rmSync(destDb, { force: true });
    fs.copyFileSync(srcDb, destDb);
    for (const suffix of ['-wal', '-shm']) {
      if (fs.existsSync(srcDb + suffix)) {
        fs.copyFileSync(srcDb + suffix, destDb + suffix);
      }
    }
  }
}

/**
 * Production entry point. Derives the old userData root from the current
 * one by swapping the leaf directory name, preserving the CGUI-64 `-dev`
 * suffix so dev migrates dev data and packaged migrates packaged data.
 * Must run after the -dev userData override in main.ts and before the
 * database or config store initialise.
 */
export function migrateLegacyUserData(): void {
  try {
    const userData = app.getPath('userData');
    const devSuffix = userData.endsWith('-dev') ? '-dev' : '';
    const oldDir = path.join(
      path.dirname(userData),
      LEGACY_USERDATA_ROOT + devSuffix,
      LEGACY_CONFIG_DIR
    );
    const newDir = path.join(userData, 'COG');

    const result = migrateLegacyDataDir(oldDir, newDir);
    if (result.migrated.length > 0) {
      console.log(
        `[legacyMigration] Migrated from ${oldDir}: ${result.migrated.join(', ')}` +
        ` (old directory left in place)`
      );
    }
    for (const e of result.errors) {
      console.error(`[legacyMigration] ${e}`);
    }

    cleanupLegacyAutostartEntry();
  } catch (err) {
    // Migration must never prevent startup — worst case the app starts empty
    // and the old data is still on disk.
    console.error('[legacyMigration] Migration failed:', err);
  }
}

/**
 * Removes the pre-rebrand autostart entry, but only when it carries the
 * managed marker (a user-authored entry under the old filename is not ours
 * to delete — same CGUI-93 rule the live writer follows). The new-filename
 * entry is written right after by the normal applyLaunchOnStartup() startup
 * call once the migrated settings load. MANAGED_KEY itself deliberately
 * kept its historical value across the rebrand so this recognition works.
 */
function cleanupLegacyAutostartEntry(): void {
  if (process.platform !== 'linux' || !app.isPackaged) return;
  const oldEntry = path.join(app.getPath('appData'), 'autostart', LEGACY_AUTOSTART_FILE);
  try {
    if (isManagedEntry(oldEntry)) {
      fs.rmSync(oldEntry, { force: true });
      console.log(`[legacyMigration] Removed pre-rebrand autostart entry (${MANAGED_KEY})`);
    }
  } catch (err) {
    console.error('[legacyMigration] Autostart cleanup failed:', err);
  }
}

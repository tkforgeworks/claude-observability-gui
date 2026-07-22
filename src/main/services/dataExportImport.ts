/**
 * Portable export/import of all app data (CGUI-49).
 *
 * Export bundles a consistent DB snapshot plus portable settings and the
 * dashboard config into a single zip. Import merges a bundle into the
 * current install: merge/skip only — no existing row is ever overwritten
 * or deleted. This supports both one-time migration to a new machine and
 * repeated bidirectional merging between two machines (desktop + laptop).
 *
 * Credential decision: connectionProfiles (and activeProfileId/syncEnabled)
 * are excluded at EXPORT time, not just import time, so tokens never enter
 * the archive at rest. Machine-specific paths (logFilePath,
 * claudeCodeDataPath) and local import bookkeeping are likewise excluded —
 * only the PORTABLE_SETTINGS_KEYS allowlist travels.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { MIGRATIONS, runMigrations } from '../db/migrations';
import type { AppSettings, DataImportSummary } from '../../shared/ipc-types';
import {
  loadSettings,
  updateSettings,
  loadDashboard,
  saveDashboard,
} from '../config/configStore';

export const EXPORT_FORMAT = 'claude-usage-monitor-export';
export const EXPORT_FORMAT_VERSION = 1;

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export interface ExportManifest {
  format: string;
  formatVersion: number;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  hostname: string;
}

/**
 * Settings keys that travel between machines. Everything else is either
 * machine-specific (paths, launch-on-startup), local bookkeeping (import
 * timestamps), or credential-bearing (connection profiles) and stays local.
 */
export const PORTABLE_SETTINGS_KEYS = [
  'minimizeToTrayOnClose',
  'showTrayNotifications',
  'chatStalenessDays',
  'usageLimitPollingEnabled',
  'usageLimitPollIntervalMs',
  'usageLimitRetentionDays',
] as const satisfies readonly (keyof AppSettings)[];

export function filterPortableSettings(settings: AppSettings): Partial<AppSettings> {
  const portable: Partial<AppSettings> = {};
  for (const key of PORTABLE_SETTINGS_KEYS) {
    if (settings[key] !== undefined) {
      (portable as Record<string, unknown>)[key] = settings[key];
    }
  }
  return portable;
}

/**
 * Per-table merge rules. Order matters: parents before children
 * (cowork_sessions before cowork_turns).
 *
 * dedupKeys null  → table has its own UNIQUE constraint; INSERT OR IGNORE.
 * dedupKeys [...] → no unique constraint; skip source rows whose key
 *                   combination already exists in the target (NULL-safe).
 */
export const MERGE_SPECS: ReadonlyArray<{ table: string; dedupKeys: string[] | null }> = [
  { table: 'app_sessions', dedupKeys: ['launched_at'] },
  { table: 'cowork_sessions', dedupKeys: null },
  { table: 'cowork_turns', dedupKeys: ['session_id', 'started_at'] },
  { table: 'code_sessions', dedupKeys: null },
  { table: 'chat_conversations', dedupKeys: null },
  { table: 'chat_projects', dedupKeys: null },
  { table: 'chat_memories', dedupKeys: null },
  { table: 'app_focus_events', dedupKeys: ['focused_at'] },
  { table: 'usage_snapshots', dedupKeys: ['captured_at'] },
];

export function validateManifest(
  manifest: unknown,
  latestSchemaVersion: number = LATEST_SCHEMA_VERSION
): { ok: true; manifest: ExportManifest } | { ok: false; error: string } {
  if (typeof manifest !== 'object' || manifest === null) {
    return { ok: false, error: 'Bundle manifest is missing or malformed.' };
  }
  const m = manifest as Partial<ExportManifest>;
  if (m.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'File is not a Claude Usage Monitor export bundle.' };
  }
  if (typeof m.schemaVersion !== 'number') {
    return { ok: false, error: 'Bundle manifest has no schema version.' };
  }
  if (m.schemaVersion > latestSchemaVersion) {
    return {
      ok: false,
      error:
        `Bundle was exported from a newer app version (schema v${m.schemaVersion}, ` +
        `this app supports up to v${latestSchemaVersion}). ` +
        `Update this install before importing.`,
    };
  }
  return { ok: true, manifest: m as ExportManifest };
}

function currentSchemaVersion(db: Database.Database): number {
  const row = db
    .prepare<[], { value: string }>(`SELECT value FROM meta WHERE key = 'schema_version'`)
    .get();
  return row ? parseInt(row.value, 10) : 0;
}

/** Columns shared by both sides of a table, minus the surrogate id. */
function sharedColumns(db: Database.Database, table: string): string[] {
  const cols = (schema: string): Set<string> =>
    new Set(
      db
        .prepare<[], { name: string }>(`SELECT name FROM ${schema}.pragma_table_info('${table}')`)
        .all()
        .map((c) => c.name)
    );
  const main = cols('main');
  const imported = cols('import_src');
  return [...main].filter((c) => c !== 'id' && imported.has(c));
}

/**
 * Merges every table from the SQLite DB at importedDbPath into db.
 * Insert-only: never updates or deletes existing target rows. The imported
 * DB must already be at the target's schema version (run migrations on it
 * first — see importAllData).
 */
export function mergeIntoDatabase(
  db: Database.Database,
  importedDbPath: string
): DataImportSummary['tables'] {
  const tables: DataImportSummary['tables'] = {};

  db.prepare('ATTACH DATABASE ? AS import_src').run(importedDbPath);
  try {
    const mergeAll = db.transaction(() => {
      for (const spec of MERGE_SPECS) {
        const cols = sharedColumns(db, spec.table);
        if (cols.length === 0) continue;
        const colList = cols.join(', ');

        const sourceCount = (
          db.prepare(`SELECT COUNT(*) AS c FROM import_src.${spec.table}`).get() as { c: number }
        ).c;

        let inserted: number;
        if (spec.dedupKeys === null) {
          inserted = db
            .prepare(
              `INSERT OR IGNORE INTO main.${spec.table} (${colList})
               SELECT ${colList} FROM import_src.${spec.table}`
            )
            .run().changes;
        } else {
          // NULL-safe key comparison via IS; GROUP BY collapses any
          // key-duplicate rows within the source itself.
          const keyMatch = spec.dedupKeys.map((k) => `m.${k} IS i.${k}`).join(' AND ');
          const groupBy = spec.dedupKeys.map((k) => `i.${k}`).join(', ');
          inserted = db
            .prepare(
              `INSERT INTO main.${spec.table} (${colList})
               SELECT ${cols.map((c) => `i.${c}`).join(', ')}
               FROM import_src.${spec.table} i
               WHERE NOT EXISTS (
                 SELECT 1 FROM main.${spec.table} m WHERE ${keyMatch}
               )
               GROUP BY ${groupBy}`
            )
            .run().changes;
        }

        tables[spec.table] = { imported: inserted, skipped: sourceCount - inserted };
      }
    });
    mergeAll();
  } finally {
    db.prepare('DETACH DATABASE import_src').run();
  }

  return tables;
}

// ---------------------------------------------------------------------------
// Bundle I/O
// ---------------------------------------------------------------------------

const BUNDLE_DB_NAME = 'usage.db';
const BUNDLE_MANIFEST_NAME = 'manifest.json';
const BUNDLE_SETTINGS_NAME = 'settings.json';
const BUNDLE_DASHBOARD_NAME = 'dashboard.json';

export async function exportAllData(
  db: Database.Database,
  destPath: string,
  appVersion: string
): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cum-export-'));
  const tmpDb = path.join(tmpDir, BUNDLE_DB_NAME);
  try {
    // Native backup gives a consistent snapshot even mid-write (WAL)
    await db.backup(tmpDb);

    const manifest: ExportManifest = {
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      schemaVersion: currentSchemaVersion(db),
      appVersion,
      exportedAt: new Date().toISOString(),
      hostname: os.hostname(),
    };

    const zip = new AdmZip();
    zip.addFile(BUNDLE_MANIFEST_NAME, Buffer.from(JSON.stringify(manifest, null, 2)));
    zip.addLocalFile(tmpDb, '', BUNDLE_DB_NAME);
    zip.addFile(
      BUNDLE_SETTINGS_NAME,
      Buffer.from(JSON.stringify(filterPortableSettings(loadSettings()), null, 2))
    );
    zip.addFile(BUNDLE_DASHBOARD_NAME, Buffer.from(JSON.stringify(loadDashboard(), null, 2)));
    zip.writeZip(destPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function importAllData(db: Database.Database, srcPath: string): DataImportSummary {
  const zip = new AdmZip(srcPath);

  // Entries are read by exact name and written to controlled paths only —
  // never extractAllTo, so hostile archive paths cannot escape the temp dir.
  const manifestEntry = zip.getEntry(BUNDLE_MANIFEST_NAME);
  const dbEntry = zip.getEntry(BUNDLE_DB_NAME);
  if (!manifestEntry || !dbEntry) {
    throw new Error('File is not a Claude Usage Monitor export bundle.');
  }

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(manifestEntry.getData().toString('utf-8'));
  } catch {
    throw new Error('Bundle manifest is missing or malformed.');
  }
  const validation = validateManifest(manifestRaw);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cum-import-'));
  const tmpDb = path.join(tmpDir, BUNDLE_DB_NAME);
  try {
    fs.writeFileSync(tmpDb, dbEntry.getData());

    // Bring an older-schema bundle up to the current schema before merging.
    // Migrations are cumulative and version-gated, so a current-version
    // bundle is a no-op here.
    const importedDb = new Database(tmpDb);
    try {
      runMigrations(importedDb);
    } finally {
      importedDb.close();
    }

    const tables = mergeIntoDatabase(db, tmpDb);

    // Preferences: portable allowlist only; the bundle was already filtered
    // at export time, but filter again in case of hand-built bundles.
    let settingsApplied = false;
    const settingsEntry = zip.getEntry(BUNDLE_SETTINGS_NAME);
    if (settingsEntry) {
      try {
        const bundleSettings = JSON.parse(settingsEntry.getData().toString('utf-8'));
        const portable = filterPortableSettings(bundleSettings as AppSettings);
        if (Object.keys(portable).length > 0) {
          updateSettings(portable);
          settingsApplied = true;
        }
      } catch {
        // Settings are best-effort; DB merge is the payload that matters
      }
    }

    let dashboardApplied = false;
    const dashboardEntry = zip.getEntry(BUNDLE_DASHBOARD_NAME);
    if (dashboardEntry) {
      try {
        saveDashboard(JSON.parse(dashboardEntry.getData().toString('utf-8')));
        dashboardApplied = true;
      } catch {
        // Best-effort, as above
      }
    }

    let totalImported = 0;
    let totalSkipped = 0;
    for (const t of Object.values(tables)) {
      totalImported += t.imported;
      totalSkipped += t.skipped;
    }

    return {
      totalImported,
      totalSkipped,
      tables,
      settingsApplied,
      dashboardApplied,
      sourceHostname: validation.manifest.hostname ?? null,
      sourceExportedAt: validation.manifest.exportedAt ?? null,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

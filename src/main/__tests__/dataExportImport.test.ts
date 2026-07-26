/**
 * Tests for the portable export/import merge logic (CGUI-49).
 *
 * Uses real SQLite databases created via the app's own migrations, with
 * fixtures simulating two different machines (distinct session ids,
 * overlapping and non-overlapping timestamps) — not just re-import of an
 * identical bundle.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import {
  mergeIntoDatabase,
  filterPortableSettings,
  validateManifest,
  EXPORT_FORMAT,
  LATEST_SCHEMA_VERSION,
  PORTABLE_SETTINGS_KEYS,
} from '../services/dataExportImport';
import type { AppSettings } from '../../shared/ipc-types';

// better-sqlite3's native binding is ABI-specific: after `npx electron-rebuild`
// it targets Electron and cannot load under jest's node runtime. CI installs
// via `npm ci` (node prebuild), so the DB-backed suite runs there; locally it
// skips after an electron-rebuild rather than failing the whole test run.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[dataExportImport.test] better-sqlite3 binding not loadable under node ' +
    '(built for Electron?) — skipping DB merge tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cum-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeDb(name: string): { db: Database.Database; dbPath: string } {
  const dbPath = path.join(tmpDir, `${name}.db`);
  const db = new Database(dbPath);
  runMigrations(db);
  return { db, dbPath };
}

function insertCodeSession(db: Database.Database, sessionId: string, costUsd: number): void {
  db.prepare(`
    INSERT INTO code_sessions (session_id, project_path, model, cost_usd, started_at)
    VALUES (?, 'C:/proj', 'claude-opus-4-8', ?, '2026-07-01T10:00:00.000Z')
  `).run(sessionId, costUsd);
}

function insertCoworkSessionWithTurn(db: Database.Database, sessionId: string, startedAt: string): void {
  db.prepare(`
    INSERT INTO cowork_sessions (session_id, started_at) VALUES (?, ?)
  `).run(sessionId, startedAt);
  db.prepare(`
    INSERT INTO cowork_turns (session_id, started_at, ended_at, duration_seconds)
    VALUES (?, ?, ?, 60)
  `).run(sessionId, startedAt, startedAt);
}

function insertUsageSnapshot(db: Database.Database, capturedAt: string, pct: number): void {
  db.prepare(`
    INSERT INTO usage_snapshots (captured_at, five_hour_pct, seven_day_pct)
    VALUES (?, ?, ?)
  `).run(capturedAt, pct, pct);
}

function count(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
}

describeDb('mergeIntoDatabase', () => {
  test('cross-machine merge: rows from both machines coexist', () => {
    const a = makeDb('machineA');
    const b = makeDb('machineB');

    insertCodeSession(a.db, 'session-a1', 1.0);
    insertCodeSession(a.db, 'session-a2', 2.0);
    insertCoworkSessionWithTurn(a.db, 'local_a1', '2026-07-01T09:00:00.000Z');
    insertUsageSnapshot(a.db, '2026-07-01T09:00:00.000Z', 10);

    insertCodeSession(b.db, 'session-b1', 3.0);
    insertCoworkSessionWithTurn(b.db, 'local_b1', '2026-07-02T09:00:00.000Z');
    insertUsageSnapshot(b.db, '2026-07-02T09:00:00.000Z', 20);
    b.db.close();

    const tables = mergeIntoDatabase(a.db, b.dbPath);

    expect(count(a.db, 'code_sessions')).toBe(3);
    expect(count(a.db, 'cowork_sessions')).toBe(2);
    expect(count(a.db, 'cowork_turns')).toBe(2);
    expect(count(a.db, 'usage_snapshots')).toBe(2);
    expect(tables.code_sessions).toEqual({ imported: 1, skipped: 0 });
    a.db.close();
  });

  test('re-importing the same source twice imports nothing new', () => {
    const a = makeDb('machineA');
    const b = makeDb('machineB');

    insertCodeSession(b.db, 'session-b1', 3.0);
    insertUsageSnapshot(b.db, '2026-07-02T09:00:00.000Z', 20);
    insertCoworkSessionWithTurn(b.db, 'local_b1', '2026-07-02T09:00:00.000Z');
    b.db.close();

    mergeIntoDatabase(a.db, b.dbPath);
    const second = mergeIntoDatabase(a.db, b.dbPath);

    expect(count(a.db, 'code_sessions')).toBe(1);
    expect(count(a.db, 'usage_snapshots')).toBe(1);
    expect(count(a.db, 'cowork_turns')).toBe(1);
    for (const t of Object.values(second)) {
      expect(t.imported).toBe(0);
    }
    a.db.close();
  });

  test('never overwrites an existing row, even when source differs', () => {
    const a = makeDb('machineA');
    const b = makeDb('machineB');

    insertCodeSession(a.db, 'shared-session', 1.0);
    insertCodeSession(b.db, 'shared-session', 99.9); // conflicting data
    b.db.close();

    mergeIntoDatabase(a.db, b.dbPath);

    const row = a.db
      .prepare(`SELECT cost_usd FROM code_sessions WHERE session_id = 'shared-session'`)
      .get() as { cost_usd: number };
    expect(count(a.db, 'code_sessions')).toBe(1);
    expect(row.cost_usd).toBe(1.0); // target's value wins by never being touched
    a.db.close();
  });

  test('bidirectional round-trip leaves both machines with the identical union', () => {
    const a = makeDb('machineA');
    const b = makeDb('machineB');

    insertCodeSession(a.db, 'session-a1', 1.0);
    insertUsageSnapshot(a.db, '2026-07-01T09:00:00.000Z', 10);
    insertCodeSession(b.db, 'session-b1', 2.0);
    insertUsageSnapshot(b.db, '2026-07-02T09:00:00.000Z', 20);
    // Overlapping sample present on both machines already
    insertUsageSnapshot(a.db, '2026-07-03T09:00:00.000Z', 30);
    insertUsageSnapshot(b.db, '2026-07-03T09:00:00.000Z', 30);

    // A → B
    a.db.close();
    mergeIntoDatabase(b.db, a.dbPath);
    // B (now union) → A
    b.db.close();
    const a2 = new Database(a.dbPath);
    mergeIntoDatabase(a2, b.dbPath);

    const b2 = new Database(b.dbPath, { readonly: true });
    for (const table of ['code_sessions', 'usage_snapshots']) {
      expect(count(a2, table)).toBe(count(b2, table));
    }
    expect(count(a2, 'code_sessions')).toBe(2);
    expect(count(a2, 'usage_snapshots')).toBe(3); // overlap not duplicated
    a2.close();
    b2.close();
  });

  test('unkeyed tables dedupe on composite/timestamp keys', () => {
    const a = makeDb('machineA');
    const b = makeDb('machineB');

    // Same cowork session id on both, but B has one extra turn
    insertCoworkSessionWithTurn(a.db, 'local_shared', '2026-07-01T09:00:00.000Z');
    insertCoworkSessionWithTurn(b.db, 'local_shared', '2026-07-01T09:00:00.000Z');
    b.db.prepare(`
      INSERT INTO cowork_turns (session_id, started_at, ended_at, duration_seconds)
      VALUES ('local_shared', '2026-07-01T10:00:00.000Z', '2026-07-01T10:01:00.000Z', 60)
    `).run();
    b.db.close();

    mergeIntoDatabase(a.db, b.dbPath);

    expect(count(a.db, 'cowork_sessions')).toBe(1); // unique session_id ignored
    expect(count(a.db, 'cowork_turns')).toBe(2);    // shared turn deduped, new turn added
    a.db.close();
  });
});

describe('filterPortableSettings', () => {
  const fullSettings: AppSettings = {
    logFilePath: 'C:/machine/specific.log',
    claudeCodeDataPath: 'C:/machine/projects',
    minimizeToTrayOnClose: false,
    launchOnStartup: true,
    showTrayNotifications: false,
    syncEnabled: true,
    activeProfileId: 'profile-1',
    connectionProfiles: [
      { id: 'profile-1', name: 'home', url: 'http://influx.internal:8086', org: 'o', bucket: 'b', hasToken: true },
    ],
    chatStalenessDays: 7,
    usageLimitPollingEnabled: true,
    usageLimitPollIntervalMs: 60_000,
    usageLimitRetentionDays: 30,
    lastChatImportAt: '2026-07-01T00:00:00.000Z',
    lastJsonlScanAt: '2026-07-01T00:00:00.000Z',
  };

  test('includes exactly the portable allowlist', () => {
    const portable = filterPortableSettings(fullSettings);
    expect(Object.keys(portable).sort()).toEqual([...PORTABLE_SETTINGS_KEYS].sort());
    expect(portable.chatStalenessDays).toBe(7);
    expect(portable.usageLimitPollIntervalMs).toBe(60_000);
  });

  test('excludes machine paths, credentials, and local bookkeeping', () => {
    const portable = filterPortableSettings(fullSettings);
    expect(portable).not.toHaveProperty('logFilePath');
    expect(portable).not.toHaveProperty('claudeCodeDataPath');
    expect(portable).not.toHaveProperty('connectionProfiles');
    expect(portable).not.toHaveProperty('activeProfileId');
    expect(portable).not.toHaveProperty('syncEnabled');
    expect(portable).not.toHaveProperty('launchOnStartup');
    expect(portable).not.toHaveProperty('lastChatImportAt');
    expect(JSON.stringify(portable)).not.toContain('influx.internal');
  });
});

describe('validateManifest', () => {
  const valid = {
    format: EXPORT_FORMAT,
    formatVersion: 1,
    schemaVersion: LATEST_SCHEMA_VERSION,
    appVersion: '1.1.0',
    exportedAt: '2026-07-22T00:00:00.000Z',
    hostname: 'test-machine',
  };

  test('accepts a current-version bundle', () => {
    expect(validateManifest(valid)).toEqual({ ok: true, manifest: valid });
  });

  test('accepts an older-schema bundle', () => {
    expect(validateManifest({ ...valid, schemaVersion: 1 }).ok).toBe(true);
  });

  test('rejects a newer-schema bundle with a clear error', () => {
    const result = validateManifest({ ...valid, schemaVersion: LATEST_SCHEMA_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('newer app version');
    }
  });

  test('rejects non-bundle files', () => {
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest({ format: 'something-else' }).ok).toBe(false);
    expect(validateManifest({ format: EXPORT_FORMAT }).ok).toBe(false); // no schemaVersion
  });
});

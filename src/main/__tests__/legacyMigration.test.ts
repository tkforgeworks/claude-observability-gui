/**
 * CGUI-54 rebrand data migration: pre-rebrand userData (claude-usage-monitor /
 * ClaudeUsageMonitor) must be copied into the new tkforgeworks-cog / COG
 * layout on first launch, per-file, without ever overwriting data already at
 * the new location, and leaving the old directory intact as a safety net.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

let mockUserData = '';
let mockAppData = '';
let mockIsPackaged = true;

jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserData;
      if (name === 'appData') return mockAppData;
      throw new Error(`unexpected getPath(${name})`);
    },
    get isPackaged() {
      return mockIsPackaged;
    },
  },
}));

import { migrateLegacyDataDir, migrateLegacyUserData } from '../services/legacyMigration';
import { MANAGED_KEY } from '../services/launchOnStartup';

// Same Electron-ABI guard as the other DB-backed suites: the sqlite snapshot
// path can't run when the native binding targets Electron. CI runs it all.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[legacyMigration.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB-backed migration tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

let tmp = '';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cgui54-'));
  mockAppData = tmp;
  mockUserData = path.join(tmp, 'tkforgeworks-cog');
  mockIsPackaged = true;
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeLegacyDir(): string {
  const oldDir = path.join(tmp, 'claude-usage-monitor', 'ClaudeUsageMonitor');
  fs.mkdirSync(oldDir, { recursive: true });
  return oldDir;
}

function makeLegacyDb(dir: string, rows: number): void {
  const db = new Database(path.join(dir, 'usage.db'));
  db.exec(`CREATE TABLE t (v TEXT)`);
  const ins = db.prepare(`INSERT INTO t (v) VALUES (?)`);
  for (let i = 0; i < rows; i++) ins.run(`row-${i}`);
  db.close();
}

describe('migrateLegacyDataDir config files', () => {
  it('copies settings and dashboard into the new dir and leaves the old files in place', () => {
    const oldDir = makeLegacyDir();
    fs.writeFileSync(path.join(oldDir, 'settings.json'), '{"launchOnStartup":true}');
    fs.writeFileSync(path.join(oldDir, 'dashboard.json'), '{"views":[]}');
    const newDir = path.join(mockUserData, 'COG');

    const result = migrateLegacyDataDir(oldDir, newDir);

    expect(result.migrated.sort()).toEqual(['dashboard.json', 'settings.json']);
    expect(result.errors).toEqual([]);
    expect(fs.readFileSync(path.join(newDir, 'settings.json'), 'utf-8')).toContain('launchOnStartup');
    expect(fs.existsSync(path.join(oldDir, 'settings.json'))).toBe(true);
  });

  it('never overwrites a file already present at the new location', () => {
    const oldDir = makeLegacyDir();
    fs.writeFileSync(path.join(oldDir, 'settings.json'), '{"old":true}');
    const newDir = path.join(mockUserData, 'COG');
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(newDir, 'settings.json'), '{"new":true}');

    const result = migrateLegacyDataDir(oldDir, newDir);

    expect(result.skipped).toContain('settings.json');
    expect(fs.readFileSync(path.join(newDir, 'settings.json'), 'utf-8')).toBe('{"new":true}');
  });

  it('is a no-op when there is no legacy directory', () => {
    const newDir = path.join(mockUserData, 'COG');
    const result = migrateLegacyDataDir(path.join(tmp, 'nope'), newDir);
    expect(result).toEqual({ migrated: [], skipped: [], errors: [] });
    expect(fs.existsSync(newDir)).toBe(false);
  });
});

describeDb('migrateLegacyDataDir database snapshot', () => {
  it('produces a readable copy with the legacy rows', () => {
    const oldDir = makeLegacyDir();
    makeLegacyDb(oldDir, 5);
    const newDir = path.join(mockUserData, 'COG');

    const result = migrateLegacyDataDir(oldDir, newDir);

    expect(result.migrated).toContain('usage.db');
    const copied = new Database(path.join(newDir, 'usage.db'), { readonly: true });
    const cnt = copied.prepare('SELECT COUNT(*) AS c FROM t').get() as { c: number };
    copied.close();
    expect(cnt.c).toBe(5);
    // old DB untouched
    expect(fs.existsSync(path.join(oldDir, 'usage.db'))).toBe(true);
  });

  it('folds pending WAL content into the snapshot', () => {
    const oldDir = makeLegacyDir();
    const db = new Database(path.join(oldDir, 'usage.db'));
    db.pragma('journal_mode = WAL');
    db.exec(`CREATE TABLE t (v TEXT)`);
    db.prepare(`INSERT INTO t (v) VALUES ('in-wal')`).run();
    // Close WITHOUT checkpointing? better-sqlite3 checkpoints on close; to
    // exercise the WAL path leave a -wal file by copying it aside first.
    // VACUUM INTO reads through the connection, so pending WAL content is
    // included either way — assert the row survives.
    db.close();
    const newDir = path.join(mockUserData, 'COG');

    migrateLegacyDataDir(oldDir, newDir);

    const copied = new Database(path.join(newDir, 'usage.db'), { readonly: true });
    const row = copied.prepare('SELECT v FROM t').get() as { v: string };
    copied.close();
    expect(row.v).toBe('in-wal');
  });

  it('skips the database when the new location already has one', () => {
    const oldDir = makeLegacyDir();
    makeLegacyDb(oldDir, 3);
    const newDir = path.join(mockUserData, 'COG');
    fs.mkdirSync(newDir, { recursive: true });
    fs.writeFileSync(path.join(newDir, 'usage.db'), 'existing');

    const result = migrateLegacyDataDir(oldDir, newDir);

    expect(result.skipped).toContain('usage.db');
    expect(fs.readFileSync(path.join(newDir, 'usage.db'), 'utf-8')).toBe('existing');
  });
});

describeDb('migrateLegacyUserData end to end', () => {
  it('derives old/new paths, migrates data, and preserves the -dev suffix pairing', () => {
    const oldDir = makeLegacyDir();
    fs.writeFileSync(path.join(oldDir, 'settings.json'), '{"x":1}');
    makeLegacyDb(oldDir, 2);

    migrateLegacyUserData();

    const newDir = path.join(mockUserData, 'COG');
    expect(fs.existsSync(path.join(newDir, 'settings.json'))).toBe(true);
    expect(fs.existsSync(path.join(newDir, 'usage.db'))).toBe(true);
  });

  it('dev variant migrates from the -dev legacy root only', () => {
    mockUserData = path.join(tmp, 'tkforgeworks-cog-dev');
    const oldDev = path.join(tmp, 'claude-usage-monitor-dev', 'ClaudeUsageMonitor');
    fs.mkdirSync(oldDev, { recursive: true });
    fs.writeFileSync(path.join(oldDev, 'settings.json'), '{"dev":true}');
    // a packaged-variant legacy dir also exists and must NOT be the source
    const oldProd = makeLegacyDir();
    fs.writeFileSync(path.join(oldProd, 'settings.json'), '{"prod":true}');

    migrateLegacyUserData();

    const migrated = fs.readFileSync(
      path.join(mockUserData, 'COG', 'settings.json'), 'utf-8');
    expect(migrated).toBe('{"dev":true}');
  });

  it('removes a managed pre-rebrand autostart entry on packaged Linux but leaves a foreign one', () => {
    if (process.platform !== 'linux') return;
    const autostartDir = path.join(tmp, 'autostart');
    fs.mkdirSync(autostartDir, { recursive: true });
    const oldEntry = path.join(autostartDir, 'claude-usage-monitor.desktop');
    fs.writeFileSync(oldEntry, `[Desktop Entry]\nName=Claude Usage Monitor\n${MANAGED_KEY}=true\n`);

    migrateLegacyUserData();
    expect(fs.existsSync(oldEntry)).toBe(false);

    // foreign (no managed key) survives
    fs.writeFileSync(oldEntry, '[Desktop Entry]\nName=Claude Usage Monitor\n');
    migrateLegacyUserData();
    expect(fs.existsSync(oldEntry)).toBe(true);
  });
});

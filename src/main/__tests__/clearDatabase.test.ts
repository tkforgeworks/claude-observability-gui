/**
 * Regression tests for CGUI-111: Clear Database must empty every user-data
 * table discovered from the schema, not a hand-written list that predated
 * usage_snapshots (v6) and code_session_hours (v8).
 */

import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { clearAllData, listDataTables, queryTableCounts } from '../db/queries';

// Same Electron-ABI guard as the other DB-backed suites: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so these run there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[clearDatabase.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB clear tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

describeDb('clearAllData (CGUI-111)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    // Mirror the production connection: FK enforcement is on, so the
    // parent-before-child DELETE order that sqlite_master's alphabetical
    // listing produces (cowork_sessions < cowork_turns) has to be survivable.
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  function seed(): void {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO code_sessions (session_id, project_path, model, started_at) VALUES ('cs1', '/p', 'claude-opus-5', ?)`).run(now);
    db.prepare(`INSERT INTO code_session_hours (session_id, hour_start, cost_usd) VALUES ('cs1', ?, 1.0)`).run(now);
    db.prepare(`INSERT INTO cowork_sessions (session_id, started_at) VALUES ('cw1', ?)`).run(now);
    db.prepare(`INSERT INTO cowork_turns (session_id, started_at, ended_at, duration_seconds) VALUES ('cw1', ?, ?, 10)`).run(now, now);
    db.prepare(`INSERT INTO app_sessions (launched_at) VALUES (?)`).run(now);
    db.prepare(`INSERT INTO app_focus_events (focused_at) VALUES (?)`).run(now);
    db.prepare(`INSERT INTO usage_snapshots (captured_at, five_hour_pct, seven_day_pct) VALUES (?, 10, 20)`).run(now);
    db.prepare(`INSERT INTO chat_projects (project_id, name, created_at) VALUES ('p1', 'proj', ?)`).run(now);
    db.prepare(`INSERT INTO chat_conversations (conversation_id, created_at) VALUES ('c1', ?)`).run(now);
    db.prepare(`INSERT INTO chat_memories (account_uuid, type) VALUES ('acct', 'user')`).run();
  }

  test('discovers the tables the old hardcoded list missed', () => {
    const tables = listDataTables(db);
    expect(tables).toEqual(expect.arrayContaining(['usage_snapshots', 'code_session_hours']));
    expect(tables).not.toContain('meta');
    expect(tables.some(t => t.startsWith('sqlite_'))).toBe(false);
  });

  test('empties every discovered table, including usage_snapshots and code_session_hours', () => {
    seed();
    const before = queryTableCounts(db);
    expect(before.usage_snapshots).toBe(1);
    expect(before.code_session_hours).toBe(1);
    expect(before.cowork_turns).toBe(1);

    const cleared = clearAllData(db);

    expect(cleared).toEqual(listDataTables(db));
    const after = queryTableCounts(db);
    expect(Object.keys(after)).toEqual(listDataTables(db));
    for (const [table, count] of Object.entries(after)) {
      expect({ table, count }).toEqual({ table, count: 0 });
    }
  });

  test('leaves the meta table (schema_version) intact', () => {
    seed();
    const versionBefore = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get();
    clearAllData(db);
    const versionAfter = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get();
    expect(versionAfter).toEqual(versionBefore);
  });

  test('re-checks foreign keys after clearing (no deferred violations leak)', () => {
    seed();
    clearAllData(db);
    expect(db.pragma('foreign_key_check')).toEqual([]);
  });
});

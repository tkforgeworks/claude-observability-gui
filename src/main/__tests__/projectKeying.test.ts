/**
 * Regression tests for CGUI-89: project keys must follow the *path's* case
 * semantics, not the host platform's. POSIX absolute paths (leading '/')
 * group exactly — case-distinct Linux directories are distinct projects —
 * while Windows-style paths (drive-letter, UNC) keep case-insensitive
 * grouping, including in a mixed DB (CGUI-49 bundles imported from Windows).
 */

import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { queryProjectAggregates } from '../db/queries';

// Same Electron-ABI guard as the other DB-backed suites.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[projectKeying.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB project-keying tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

let seq = 0;
function insertCodeSession(
  db: Database.Database,
  projectPath: string,
  costUsd: number,
  model: string = 'claude-opus-5'
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO code_sessions (session_id, project_path, model, cost_usd, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`code-${seq++}`, projectPath, model, costUsd, now, now);
}

function insertCoworkSession(db: Database.Database, projectPath: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO cowork_sessions (session_id, project_path, started_at, ended_at)
    VALUES (?, ?, ?, ?)
  `).run(`cowork-${seq++}`, projectPath, now, now);
}

describeDb('queryProjectAggregates path-style keying (CGUI-89)', () => {
  test('case-distinct POSIX directories stay distinct projects', () => {
    const db = makeDb();
    insertCodeSession(db, '/home/u/Proj', 1.0);
    insertCodeSession(db, '/home/u/proj', 2.0);

    const rows = queryProjectAggregates(db, 30);
    expect(rows).toHaveLength(2);
    const paths = rows.map(r => r.projectPath).sort();
    expect(paths).toEqual(['/home/u/Proj', '/home/u/proj']);
    const byPath = new Map(rows.map(r => [r.projectPath, r]));
    expect(byPath.get('/home/u/Proj')!.totalCostUsd).toBeCloseTo(1.0, 6);
    expect(byPath.get('/home/u/proj')!.totalCostUsd).toBeCloseTo(2.0, 6);
    db.close();
  });

  test('case-distinct Windows paths still merge into one project', () => {
    const db = makeDb();
    insertCodeSession(db, 'C:\\Users\\U\\Proj', 1.0);
    insertCodeSession(db, 'c:\\users\\u\\proj', 2.0);

    const rows = queryProjectAggregates(db, 30);
    expect(rows).toHaveLength(1);
    expect(rows[0].codeSessionCount).toBe(2);
    expect(rows[0].totalCostUsd).toBeCloseTo(3.0, 6);
    db.close();
  });

  test('mixed DB: Windows paths fold while POSIX paths group exactly', () => {
    const db = makeDb();
    insertCodeSession(db, 'C:\\Code\\App', 1.0);
    insertCodeSession(db, 'c:\\code\\app', 1.0);
    insertCodeSession(db, '/home/u/App', 1.0);
    insertCodeSession(db, '/home/u/app', 1.0);

    const rows = queryProjectAggregates(db, 30);
    expect(rows).toHaveLength(3);
    db.close();
  });

  test('cowork sessions join code sessions under the same exact POSIX key', () => {
    const db = makeDb();
    insertCodeSession(db, '/home/u/Proj', 1.0);
    insertCoworkSession(db, '/home/u/Proj');
    insertCoworkSession(db, '/home/u/proj');

    const rows = queryProjectAggregates(db, 30);
    expect(rows).toHaveLength(2);
    const byPath = new Map(rows.map(r => [r.projectPath, r]));
    expect(byPath.get('/home/u/Proj')).toMatchObject({ codeSessionCount: 1, coworkSessionCount: 1 });
    expect(byPath.get('/home/u/proj')).toMatchObject({ codeSessionCount: 0, coworkSessionCount: 1 });
    db.close();
  });

  test('model breakdown keys consistently with the session grouping', () => {
    const db = makeDb();
    insertCodeSession(db, '/home/u/Proj', 1.0, 'claude-opus-5');
    insertCodeSession(db, '/home/u/proj', 1.0, 'claude-sonnet-5');

    const rows = queryProjectAggregates(db, 30);
    const byPath = new Map(rows.map(r => [r.projectPath, r]));
    expect(byPath.get('/home/u/Proj')!.models).toEqual({ 'claude-opus-5': 1 });
    expect(byPath.get('/home/u/proj')!.models).toEqual({ 'claude-sonnet-5': 1 });
    db.close();
  });
});

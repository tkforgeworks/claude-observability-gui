/**
 * Regression tests for CGUI-137: sessions on a model missing from the pricing
 * table are stored with a NULL cost and silently drop out of every total.
 * Adding the model must reprice them (including ones whose JSONL is gone),
 * and any still-unpriced model must be discoverable so the UI can say so.
 */

import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { queryUnpricedModels, repriceUnpricedSessions } from '../db/queries';

// Same Electron-ABI guard as the other DB-backed suites: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so these run there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[unpricedModels.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB unpriced-model tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

function insertSession(db: Database.Database, sessionId: string, model: string | null, costUsd: number | null): void {
  // 1M input + 1M output + 1M cache write + 1M cache read, split over two hours
  db.prepare(`
    INSERT INTO code_sessions (session_id, project_path, model, input_tokens, output_tokens,
      cache_creation_tokens, cache_read_tokens, cost_usd, started_at, ended_at)
    VALUES (?, '/p', ?, 1000000, 1000000, 1000000, 1000000, ?,
      '2026-09-20T10:00:00.000Z', '2026-09-20T11:30:00.000Z')
  `).run(sessionId, model, costUsd);
  const hour = db.prepare(`
    INSERT INTO code_session_hours (session_id, hour_start, input_tokens, output_tokens,
      cache_creation_tokens, cache_read_tokens, cost_usd)
    VALUES (?, ?, 500000, 500000, 500000, 500000, ?)
  `);
  const hourCost = costUsd == null ? null : costUsd / 2;
  hour.run(sessionId, '2026-09-20T10:00:00.000Z', hourCost);
  hour.run(sessionId, '2026-09-20T11:00:00.000Z', hourCost);
}

const cost = (db: Database.Database, id: string) =>
  (db.prepare(`SELECT cost_usd FROM code_sessions WHERE session_id = ?`).get(id) as { cost_usd: number | null }).cost_usd;

const hourCosts = (db: Database.Database, id: string) =>
  (db.prepare(`SELECT cost_usd FROM code_session_hours WHERE session_id = ? ORDER BY hour_start`).all(id) as {
    cost_usd: number | null;
  }[]).map((r) => r.cost_usd);

describeDb('repriceUnpricedSessions (CGUI-137)', () => {
  it('prices NULL-cost sessions and their hourly rows once the model is known', () => {
    const db = makeDb();
    insertSession(db, 'opus55', 'claude-opus-5-5', null);

    expect(repriceUnpricedSessions(db)).toBe(1);

    // $4 input + $20 output + $5 cache write (5m rate) + $0.20 cache read
    expect(cost(db, 'opus55')).toBeCloseTo(29.2, 6);
    const hours = hourCosts(db, 'opus55');
    expect(hours[0]).toBeCloseTo(14.6, 6);
    expect(hours[1]).toBeCloseTo(14.6, 6);
  });

  it('leaves unknown models and already-priced sessions untouched', () => {
    const db = makeDb();
    insertSession(db, 'future', 'claude-future-9', null);
    insertSession(db, 'priced', 'claude-fable-5-1', 12.34);
    insertSession(db, 'nomodel', null, null);

    expect(repriceUnpricedSessions(db)).toBe(0);
    expect(cost(db, 'future')).toBeNull();
    expect(hourCosts(db, 'future')).toEqual([null, null]);
    expect(cost(db, 'priced')).toBe(12.34);
    expect(cost(db, 'nomodel')).toBeNull();
  });
});

describeDb('queryUnpricedModels (CGUI-137)', () => {
  it('lists only models missing from the pricing table, with session counts', () => {
    const db = makeDb();
    insertSession(db, 'f1', 'claude-future-9', null);
    insertSession(db, 'f2', 'claude-future-9', null);
    insertSession(db, 'x1', 'claude-other-1', null);
    insertSession(db, 'opus55', 'claude-opus-5-5', null); // known, just not repriced yet
    insertSession(db, 'priced', 'claude-fable-5-1', 1);

    expect(queryUnpricedModels(db)).toEqual([
      { model: 'claude-future-9', sessionCount: 2 },
      { model: 'claude-other-1', sessionCount: 1 },
    ]);
  });

  it('returns an empty list when every session is priced', () => {
    const db = makeDb();
    insertSession(db, 'priced', 'claude-fable-5-1', 1);
    expect(queryUnpricedModels(db)).toEqual([]);
  });
});

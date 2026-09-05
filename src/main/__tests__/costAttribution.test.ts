/**
 * Regression tests for CGUI-87: window/day-bucketed cost queries must
 * attribute usage to when it happened (code_session_hours), not dump a
 * multi-day session's lifetime cost on one bucket.
 *
 * Observed bug: the Today card reported $118.45 while the sessions view
 * showed ~$5.87 of activity today, because two sessions spanning Aug 6→8
 * matched the rolling 24h window via their recent ended_at and contributed
 * their entire cost.
 */

import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { localDateStr, queryTodaySummary, queryDailyCosts } from '../db/queries';

// Same Electron-ABI guard as the other DB-backed suites: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so these run there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[costAttribution.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB cost-attribution tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

function insertSession(
  db: Database.Database,
  sessionId: string,
  costUsd: number | null,
  startedAt: string,
  endedAt: string | null
): void {
  db.prepare(`
    INSERT INTO code_sessions (session_id, project_path, model, cost_usd, started_at, ended_at)
    VALUES (?, '/home/u/proj', 'claude-opus-5', ?, ?, ?)
  `).run(sessionId, costUsd, startedAt, endedAt);
}

function insertHour(
  db: Database.Database,
  sessionId: string,
  hourStart: string,
  costUsd: number | null
): void {
  db.prepare(`
    INSERT INTO code_session_hours (session_id, hour_start, cost_usd)
    VALUES (?, ?, ?)
  `).run(sessionId, hourStart, costUsd);
}

/** ISO timestamp `hoursAgo` hours before now, floored to the UTC hour. */
function hourAgoIso(hoursAgo: number): string {
  const d = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

describeDb('queryTodaySummary cost attribution (CGUI-87)', () => {
  test('a multi-day session contributes only its in-window hourly cost', () => {
    const db = makeDb();
    // Session spanning three days, ended within the window: most of its
    // spend happened days ago, a little happened an hour ago.
    insertSession(db, 'multi-day', 64.5, hourAgoIso(70), hourAgoIso(1));
    insertHour(db, 'multi-day', hourAgoIso(70), 30.0);
    insertHour(db, 'multi-day', hourAgoIso(50), 30.0);
    insertHour(db, 'multi-day', hourAgoIso(1), 4.5);
    // Session entirely within the window.
    insertSession(db, 'today', 5.87, hourAgoIso(2), hourAgoIso(1));
    insertHour(db, 'today', hourAgoIso(2), 5.87);

    const summary = queryTodaySummary(db);
    // Both sessions were active in the window; only in-window spend counts.
    expect(summary.codeSessionCount).toBe(2);
    expect(summary.codeCostUsd).toBeCloseTo(4.5 + 5.87, 6);
    db.close();
  });

  test('sessions without hourly rows fall back to whole-session attribution', () => {
    const db = makeDb();
    // Legacy row (imported pre-migration, no rescan yet): keeps old behavior
    // instead of vanishing from the card.
    insertSession(db, 'legacy', 10.0, hourAgoIso(3), hourAgoIso(2));
    // Bucketed session outside the window contributes nothing.
    insertSession(db, 'old', 99.0, hourAgoIso(80), hourAgoIso(78));
    insertHour(db, 'old', hourAgoIso(80), 99.0);

    const summary = queryTodaySummary(db);
    expect(summary.codeCostUsd).toBeCloseTo(10.0, 6);
    db.close();
  });

  test('no sessions at all yields null cost, not zero', () => {
    const db = makeDb();
    expect(queryTodaySummary(db).codeCostUsd).toBeNull();
    db.close();
  });
});

describeDb('queryDailyCosts attribution (CGUI-87)', () => {
  /** Local 3 PM `daysAgo` days ago — safely inside its local calendar day. */
  function localAfternoon(daysAgo: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(15, 0, 0, 0);
    return d;
  }

  test('spreads a multi-day session cost over the days it was used; counts stay on the start day', () => {
    const db = makeDb();
    const day2 = localAfternoon(2);
    const day1 = localAfternoon(1);
    const day0 = localAfternoon(0);

    insertSession(db, 'spread', 17.0, day2.toISOString(), day0.toISOString());
    insertHour(db, 'spread', day2.toISOString(), 10.0);
    insertHour(db, 'spread', day1.toISOString(), 5.0);
    insertHour(db, 'spread', day0.toISOString(), 2.0);

    const rows = queryDailyCosts(db, 7);
    const byDate = new Map(rows.map(r => [r.date, r]));

    expect(byDate.get(localDateStr(day2))).toMatchObject({ costUsd: 10.0, sessionCount: 1 });
    expect(byDate.get(localDateStr(day1))).toMatchObject({ costUsd: 5.0, sessionCount: 0 });
    expect(byDate.get(localDateStr(day0))).toMatchObject({ costUsd: 2.0, sessionCount: 0 });
    db.close();
  });

  test('legacy sessions without hourly rows keep whole-cost-on-start-day', () => {
    const db = makeDb();
    const day1 = localAfternoon(1);
    insertSession(db, 'legacy', 8.0, day1.toISOString(), day1.toISOString());

    const rows = queryDailyCosts(db, 7);
    const row = rows.find(r => r.date === localDateStr(day1));
    expect(row).toMatchObject({ costUsd: 8.0, sessionCount: 1 });
    db.close();
  });
});

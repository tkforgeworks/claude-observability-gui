/**
 * Regression tests for CGUI-52: date-grouped analytics must bucket by LOCAL
 * calendar day, not UTC. An evening session in America/New_York (e.g. 9:39 PM
 * EDT Tuesday = 01:39Z Wednesday) must appear under Tuesday.
 *
 * TZ is pinned to America/New_York because CI runs on Ubuntu in UTC, where
 * 'localtime' === UTC and these assertions would pass trivially. Modern Node
 * invalidates its cached timezone when process.env.TZ changes, and SQLite's
 * 'localtime' modifier follows the OS/libc conversion, which respects TZ on
 * Linux. (On Windows the DB-backed suite is skipped anyway — see below.)
 */

process.env.TZ = 'America/New_York';

import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { localDateStr, queryWeeklyActivity } from '../db/queries';

// Same Electron-ABI guard as dataExportImport.test.ts: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so the DB-backed suite runs there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[timezoneBucketing.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB bucketing tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

describe('localDateStr', () => {
  test('buckets an evening-EDT UTC-rollover timestamp to the local day', () => {
    // 01:39Z on July 22 is 9:39 PM EDT on July 21
    expect(localDateStr(new Date('2026-07-22T01:39:00Z'))).toBe('2026-07-21');
  });

  test('leaves a midday timestamp on the same day', () => {
    // 16:00Z on July 22 is 12:00 PM EDT on July 22
    expect(localDateStr(new Date('2026-07-22T16:00:00Z'))).toBe('2026-07-22');
  });
});

describeDb('queryWeeklyActivity local-day bucketing', () => {
  let tmpDir: string;
  let db: Database.Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cum-tz-'));
    db = new Database(path.join(tmpDir, 'tz.db'));
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('an evening session buckets under the current local day, not tomorrow', () => {
    // 9 PM local today: its UTC calendar date is already tomorrow (EDT = UTC-4)
    const evening = new Date();
    evening.setHours(21, 0, 0, 0);
    const localDay = localDateStr(evening);

    db.prepare(`
      INSERT INTO code_sessions (session_id, project_path, model, cost_usd, started_at)
      VALUES ('tz-session', 'C:/proj', 'claude-opus-4-8', 1.0, ?)
    `).run(evening.toISOString());

    const week = queryWeeklyActivity(db);
    const todayRow = week.find(d => d.date === localDay);
    expect(todayRow).toBeDefined();
    expect(todayRow?.codeCount).toBe(1);

    // The UTC date of that timestamp (tomorrow local) must NOT carry the count
    const utcDay = evening.toISOString().slice(0, 10);
    if (utcDay !== localDay) {
      const utcRow = week.find(d => d.date === utcDay);
      expect(utcRow?.codeCount ?? 0).toBe(0);
    }
  });

  test('the 7-day scaffold ends on the local today', () => {
    const week = queryWeeklyActivity(db);
    expect(week).toHaveLength(7);
    expect(week[6].date).toBe(localDateStr());
  });
});

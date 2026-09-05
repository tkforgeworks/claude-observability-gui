/**
 * Regression tests for CGUI-109: the Cache Efficiency widget's estimated
 * savings must derive from PRICING_TABLE, not a hardcoded SQL CASE that knew
 * three models and priced everything else at the Sonnet 4.6 rate.
 */

import Database from 'better-sqlite3';
import { runMigrations } from '../db/migrations';
import { queryCacheEfficiency } from '../db/queries';
import { calculateCacheSavings } from '../importers/costCalculator';
import { PRICING_TABLE } from '../config/pricing';

// Same Electron-ABI guard as the other DB-backed suites: the native binding
// can't load under jest's node runtime after an electron-rebuild. CI installs
// the node prebuild, so these run there.
let sqliteAvailable = true;
try {
  new Database(':memory:').close();
} catch {
  sqliteAvailable = false;
  console.warn(
    '[cacheSavings.test] better-sqlite3 binding not loadable under node — ' +
    'skipping DB cache-savings tests. They run in CI.'
  );
}
const describeDb = sqliteAvailable ? describe : describe.skip;

describe('calculateCacheSavings', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('uses the Fable 5.1 $0.25/MTok cache-read rate against its $10 input rate', () => {
    // 1M cache-read tokens: fresh input would cost $10, cache read costs $0.25
    expect(calculateCacheSavings('claude-fable-5-1', 1_000_000)).toBeCloseTo(9.75, 6);
  });

  it('matches PRICING_TABLE for every known model', () => {
    for (const [model, pricing] of Object.entries(PRICING_TABLE)) {
      const expected = 2 * (pricing.inputPerMillion - pricing.cacheReadPerMillion);
      expect(calculateCacheSavings(model, 2_000_000)).toBeCloseTo(expected, 6);
    }
  });

  it('returns null (not the Sonnet 4.6 rate) for an unrecognised model and warns', () => {
    expect(calculateCacheSavings('claude-unknown-x', 1_000_000)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unrecognised model: claude-unknown-x')
    );
  });

  it('returns 0 for zero cache reads', () => {
    expect(calculateCacheSavings('claude-sonnet-5', 0)).toBe(0);
  });
});

describeDb('queryCacheEfficiency estimated savings (CGUI-109)', () => {
  let db: Database.Database;
  let warnSpy: jest.SpyInstance;

  function insertSession(
    sessionId: string,
    project: string,
    model: string | null,
    cacheRead: number,
    input = 1000
  ): void {
    db.prepare(`
      INSERT INTO code_sessions
        (session_id, project_path, model, cost_usd, started_at,
         input_tokens, cache_read_tokens, cache_creation_tokens)
      VALUES (?, ?, ?, 1.0, ?, ?, ?, 1000)
    `).run(sessionId, project, model, new Date().toISOString(), input, cacheRead);
  }

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    db.close();
  });

  it("prices a Fable 5.1 session's savings at the $0.25 cache-read rate", () => {
    insertSession('s1', '/home/u/fable', 'claude-fable-5-1', 1_000_000);

    const [row] = queryCacheEfficiency(db, 7);
    expect(row.project).toBe('u/fable');
    expect(row.estimatedSavingsUsd).toBeCloseTo(9.75, 2);
  });

  it('sums mixed-model sessions in one project at each model’s own rate', () => {
    insertSession('s1', '/home/u/mixed', 'claude-fable-5-1', 1_000_000); // 9.75
    insertSession('s2', '/home/u/mixed', 'claude-opus-5', 1_000_000);    // 4.50
    insertSession('s3', '/home/u/mixed', 'claude-haiku-4-5-20251001', 1_000_000); // 0.90

    const [row] = queryCacheEfficiency(db, 7);
    expect(row.estimatedSavingsUsd).toBeCloseTo(15.15, 2);
    expect(row.sessionCount).toBe(3);
  });

  it('contributes zero savings for an unrecognised model and logs it', () => {
    insertSession('s1', '/home/u/unknown', 'claude-future-9', 1_000_000);

    const [row] = queryCacheEfficiency(db, 7);
    expect(row.estimatedSavingsUsd).toBe(0);
    // Token stats are still reported — only the dollar estimate is unknown.
    expect(row.cacheReadTokens).toBe(1_000_000);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unrecognised model: claude-future-9')
    );
  });

  it('contributes zero savings for a NULL model without warning', () => {
    insertSession('s1', '/home/u/nomodel', null, 1_000_000);

    const [row] = queryCacheEfficiency(db, 7);
    expect(row.estimatedSavingsUsd).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

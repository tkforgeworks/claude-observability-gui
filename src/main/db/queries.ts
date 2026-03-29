/**
 * Query functions for IPC handlers.
 * All functions receive an explicit database connection so they remain
 * pure and testable without global state.
 *
 * Each function is a stub — return types are correct but bodies need implementing.
 * @see src/main/ipc/handlers.ts for how these are wired to IPC channels
 */

import type Database from 'better-sqlite3';
import type {
  CodeSession,
  CoworkSession,
  CoworkTurn,
  TodaySummary,
  DateRange,
} from '../../shared/ipc-types';

// ---------------------------------------------------------------------------
// Code Sessions
// ---------------------------------------------------------------------------

/**
 * Returns all code sessions within the given date range.
 * Results should be ordered by started_at descending.
 */
export function queryCodeSessions(
  db: Database.Database,
  range: DateRange
): CodeSession[] {
  const stmt = db.prepare(`
    SELECT id, session_id, project_path, model, slug, input_tokens, output_tokens,
           cache_creation_tokens, cache_read_tokens, cost_usd, started_at, ended_at
    FROM code_sessions
    WHERE started_at >= ? AND started_at <= ?
    ORDER BY started_at DESC
  `);
  return stmt.all(range.from, range.to) as CodeSession[];
}

/**
 * Returns code sessions for a specific project within the given date range.
 */
export function queryCodeSessionsByProject(
  db: Database.Database,
  project: string,
  range: DateRange
): CodeSession[] {
  // TODO: implement — filter by project_path = project
  throw new UnsupportedOperationError('queryCodeSessionsByProject');
}

// ---------------------------------------------------------------------------
// Cowork Sessions
// ---------------------------------------------------------------------------

/**
 * Returns a today-summary aggregate for the Today view metric cards.
 * Counts sessions, turns, sums cost_usd, estimates active time from focus events.
 */
export function queryTodaySummary(db: Database.Database): TodaySummary {
  // Rolling 24-hour window from now
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Code sessions active in the last 24h:
  // started in window, OR ended in window, OR still running (ended_at IS NULL) and started before now
  const codeRow = db.prepare<[string, string], { cnt: number; total_cost: number | null }>(`
    SELECT COUNT(*) as cnt, SUM(cost_usd) as total_cost
    FROM code_sessions
    WHERE started_at >= ?
       OR (ended_at IS NOT NULL AND ended_at >= ?)
       OR (ended_at IS NULL AND started_at IS NOT NULL)
  `).get(cutoff, cutoff);

  const codeSessionCount = codeRow?.cnt ?? 0;
  const codeCostUsd = codeRow?.total_cost ?? null;

  // Cowork sessions active in the last 24h
  const coworkRow = db.prepare<[string, string], { cnt: number }>(`
    SELECT COUNT(*) as cnt
    FROM cowork_sessions
    WHERE started_at >= ?
       OR (ended_at IS NOT NULL AND ended_at >= ?)
       OR (ended_at IS NULL AND started_at IS NOT NULL)
  `).get(cutoff, cutoff);

  const coworkSessionCount = coworkRow?.cnt ?? 0;

  // Cowork turns in the last 24h
  const turnRow = db.prepare<[string], { cnt: number; avg_dur: number | null }>(`
    SELECT COUNT(*) as cnt, AVG(duration_seconds) as avg_dur
    FROM cowork_turns
    WHERE started_at >= ?
  `).get(cutoff);

  const coworkTurnCount = turnRow?.cnt ?? 0;
  const avgTurnDurationSeconds = turnRow?.avg_dur ?? null;

  // Active time from focus events in the last 24h
  const focusRow = db.prepare<[string], { total_gap: number | null; last_focus: string | null }>(`
    SELECT SUM(gap_since_last_ms) as total_gap, MAX(focused_at) as last_focus
    FROM app_focus_events
    WHERE focused_at >= ?
  `).get(cutoff);

  const activeTimeSeconds = focusRow?.total_gap != null
    ? Math.round(focusRow.total_gap / 1000)
    : null;
  const lastFocusedAt = focusRow?.last_focus ?? null;

  return {
    sessionCount: codeSessionCount + coworkSessionCount,
    coworkSessionCount,
    codeSessionCount,
    coworkTurnCount,
    avgTurnDurationSeconds,
    codeCostUsd,
    activeTimeSeconds,
    lastFocusedAt,
  };
}

/**
 * Returns all cowork sessions within the given date range.
 */
export function queryCoworkSessions(
  db: Database.Database,
  range: DateRange
): CoworkSession[] {
  // TODO: implement — SELECT from cowork_sessions WHERE started_at BETWEEN range.from AND range.to ORDER BY started_at DESC
  throw new UnsupportedOperationError('queryCoworkSessions');
}

/**
 * Returns all turns for a given cowork session, ordered by started_at.
 */
export function queryCoworkTurns(
  db: Database.Database,
  sessionId: string
): CoworkTurn[] {
  // TODO: implement — SELECT from cowork_turns WHERE session_id = sessionId ORDER BY started_at
  throw new UnsupportedOperationError('queryCoworkTurns');
}

// ---------------------------------------------------------------------------
// Cost recalculation
// ---------------------------------------------------------------------------

/**
 * Recomputes cost_usd for every row in code_sessions using the current pricing table.
 * Executes updates in a single transaction.
 * @see §2.4 "Cost recomputation" in architecture doc
 */
export function recalculateAllCosts(db: Database.Database): void {
  // TODO: implement
  // 1. Read all rows from code_sessions (id, model, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
  // 2. For each row, call costCalculator.calculateCost(...)
  // 3. Batch UPDATE in a single transaction
  throw new UnsupportedOperationError('recalculateAllCosts');
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/**
 * Counts unsynced rows per table for the SyncStatus response.
 */
export function queryUnsyncedCounts(db: Database.Database): {
  app_sessions: number;
  cowork_sessions: number;
  cowork_turns: number;
  code_sessions: number;
  chat_conversations: number;
} {
  // TODO: implement — SELECT COUNT(*) FROM <table> WHERE synced_to_influx = 0 for each table
  throw new UnsupportedOperationError('queryUnsyncedCounts');
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

class UnsupportedOperationError extends Error {
  constructor(functionName: string) {
    super(`Not yet implemented: ${functionName}`);
    this.name = 'UnsupportedOperationError';
  }
}

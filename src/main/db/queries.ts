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
  // TODO: implement — SELECT from code_sessions WHERE started_at BETWEEN range.from AND range.to ORDER BY started_at DESC
  throw new UnsupportedOperationError('queryCodeSessions');
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
  // TODO: implement — aggregate across cowork_sessions, code_sessions, cowork_turns, app_focus_events
  // for rows where started_at >= start of current calendar day (UTC)
  throw new UnsupportedOperationError('queryTodaySummary');
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

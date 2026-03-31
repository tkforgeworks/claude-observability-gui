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
  DailyActivity,
  TodaySummary,
  TimelineEntry,
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
 * Returns timeline entries for the last 24 hours — both code and cowork
 * sessions with turn timestamps for cowork. Used by the Today view timeline.
 */
export function queryTodayTimeline(db: Database.Database): TimelineEntry[] {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Code sessions active in the last 24h:
  // started in window, OR ended in window, OR still open but started in window
  const codeRows = db.prepare<[string, string, string], { session_id: string; project_path: string | null; started_at: string; ended_at: string | null }>(`
    SELECT session_id, project_path, started_at, ended_at
    FROM code_sessions
    WHERE started_at >= ?
       OR (ended_at IS NOT NULL AND ended_at >= ?)
       OR (ended_at IS NULL AND started_at >= ?)
  `).all(cutoff, cutoff, cutoff);

  const codeEntries: TimelineEntry[] = codeRows.map(r => ({
    type: 'code',
    sessionId: r.session_id,
    projectPath: r.project_path,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    turnTimestamps: [],
  }));

  // Cowork sessions active in the last 24h
  const coworkRows = db.prepare<[string, string, string], { session_id: string; started_at: string; ended_at: string | null }>(`
    SELECT session_id, started_at, ended_at
    FROM cowork_sessions
    WHERE started_at >= ?
       OR (ended_at IS NOT NULL AND ended_at >= ?)
       OR (ended_at IS NULL AND started_at >= ?)
  `).all(cutoff, cutoff, cutoff);

  // Batch-fetch turns for all cowork sessions
  const turnStmt = db.prepare<[string], { started_at: string }>(`
    SELECT started_at FROM cowork_turns WHERE session_id = ? AND ended_at != '' ORDER BY started_at
  `);

  const coworkEntries: TimelineEntry[] = coworkRows.map(r => ({
    type: 'cowork',
    sessionId: r.session_id,
    projectPath: null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    turnTimestamps: turnStmt.all(r.session_id).map(t => t.started_at),
  }));

  return [...codeEntries, ...coworkEntries].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
}

/**
 * Returns all cowork sessions within the given date range.
 */
export function queryCoworkSessions(
  db: Database.Database,
  range: DateRange
): CoworkSession[] {
  const stmt = db.prepare(`
    SELECT cs.id, cs.session_id, cs.cli_session_id, cs.title, cs.project_path,
           cs.started_at, cs.ended_at, cs.turn_count,
           (SELECT AVG(ct.duration_seconds) FROM cowork_turns ct
            WHERE ct.session_id = cs.session_id
              AND ct.ended_at != '' AND ct.duration_seconds IS NOT NULL
           ) as avg_turn_seconds
    FROM cowork_sessions cs
    WHERE cs.started_at >= ? AND cs.started_at <= ?
    ORDER BY cs.started_at DESC
  `);
  return stmt.all(range.from, range.to) as CoworkSession[];
}

/**
 * Returns all turns for a given cowork session, ordered by started_at.
 */
export function queryCoworkTurns(
  db: Database.Database,
  sessionId: string
): CoworkTurn[] {
  const stmt = db.prepare(`
    SELECT id, session_id, started_at, ended_at, duration_seconds
    FROM cowork_turns
    WHERE session_id = ? AND ended_at != ''
    ORDER BY started_at ASC
  `);
  return stmt.all(sessionId) as CoworkTurn[];
}

// ---------------------------------------------------------------------------
// App Sessions
// ---------------------------------------------------------------------------

/**
 * Inserts an app launch record. Deduplicates using a 5-second window —
 * Claude Desktop emits `Starting app {` twice within ~1 second on startup,
 * so we skip the insert if a launch already exists within 5 seconds.
 */
export function insertAppLaunch(
  db: Database.Database,
  launchedAt: string
): boolean {
  const result = db.prepare(`
    INSERT INTO app_sessions (launched_at)
    SELECT ?
    WHERE NOT EXISTS (
      SELECT 1 FROM app_sessions
      WHERE ABS(julianday(launched_at) - julianday(?)) * 86400 < 5
    )
  `).run(launchedAt, launchedAt);
  return result.changes > 0;
}

/**
 * Closes the most recent open app session (quit_at IS NULL) by setting
 * quit_at and computing duration_seconds. If no open session exists, this
 * is a no-op (the monitor may have missed the launch event).
 */
export function closeAppSession(
  db: Database.Database,
  quitAt: string
): boolean {
  const result = db.prepare(`
    UPDATE app_sessions
    SET quit_at = ?,
        duration_seconds = CAST(
          (julianday(?) - julianday(launched_at)) * 86400 AS INTEGER
        )
    WHERE id = (
      SELECT id FROM app_sessions
      WHERE quit_at IS NULL
      ORDER BY launched_at DESC
      LIMIT 1
    )
  `).run(quitAt, quitAt);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Cowork Sessions (log watcher persistence)
// ---------------------------------------------------------------------------

/**
 * Creates a cowork session if it doesn't already exist.
 * Uses INSERT OR IGNORE since session_id has a UNIQUE constraint.
 */
export function upsertCoworkSession(
  db: Database.Database,
  sessionId: string,
  startedAt: string,
  projectPath?: string
): boolean {
  const result = db.prepare(`
    INSERT OR IGNORE INTO cowork_sessions (session_id, started_at, project_path)
    VALUES (?, ?, ?)
  `).run(sessionId, startedAt, projectPath ?? null);
  return result.changes > 0;
}

/**
 * Sets the CLI session ID on an existing cowork session.
 */
export function updateCoworkSessionCliId(
  db: Database.Database,
  sessionId: string,
  cliSessionId: string
): boolean {
  const result = db.prepare(`
    UPDATE cowork_sessions SET cli_session_id = ?
    WHERE session_id = ? AND (cli_session_id IS NULL OR cli_session_id != ?)
  `).run(cliSessionId, sessionId, cliSessionId);
  return result.changes > 0;
}

/**
 * Records the start of a new cowork turn. The turn stays "open" (ended_at
 * will be updated by completeCoworkTurn when the turn finishes).
 *
 * Dedup: skip if an open turn already exists for this session (started_at
 * set but ended_at placeholder not yet overwritten).
 */
export function insertCoworkTurn(
  db: Database.Database,
  sessionId: string,
  startedAt: string
): boolean {
  // Use a placeholder ended_at that will be overwritten on completion.
  // We need ended_at NOT NULL per schema, so use empty string as sentinel.
  // Dedup on session_id + started_at so backfill doesn't create duplicates
  // for already-completed turns.
  const result = db.prepare(`
    INSERT INTO cowork_turns (session_id, started_at, ended_at)
    SELECT ?, ?, ''
    WHERE NOT EXISTS (
      SELECT 1 FROM cowork_turns
      WHERE session_id = ? AND started_at = ?
    )
  `).run(sessionId, startedAt, sessionId, startedAt);
  return result.changes > 0;
}

/**
 * Completes the most recent open turn for a session — sets ended_at,
 * computes duration_seconds, and increments the session's turn_count.
 */
export function completeCoworkTurn(
  db: Database.Database,
  sessionId: string,
  endedAt: string
): boolean {
  let wasNew = false;
  const complete = db.transaction(() => {
    // Close the open turn (ended_at = '' sentinel).
    // Returns changes = 0 if the turn was already completed (backfill dedup).
    const result = db.prepare(`
      UPDATE cowork_turns
      SET ended_at = ?,
          duration_seconds = CAST(
            (julianday(?) - julianday(started_at)) * 86400 AS INTEGER
          )
      WHERE session_id = ? AND ended_at = ''
    `).run(endedAt, endedAt, sessionId);

    wasNew = result.changes > 0;

    // Only increment turn_count if we actually closed a turn
    if (wasNew) {
      db.prepare(`
        UPDATE cowork_sessions
        SET turn_count = turn_count + 1,
            ended_at = ?
        WHERE session_id = ?
      `).run(endedAt, sessionId);
    }
  });
  complete();
  return wasNew;
}

/**
 * Closes all open cowork sessions and their open turns at the given timestamp.
 * Called when an app_quit event fires — any session still running at quit time
 * was abandoned without a proper lifecycle close.
 */
export function closeAllOpenCoworkSessions(
  db: Database.Database,
  closedAt: string
): void {
  const close = db.transaction(() => {
    // Close open turns (ended_at = '' sentinel)
    db.prepare(`
      UPDATE cowork_turns
      SET ended_at = ?,
          duration_seconds = CAST(
            (julianday(?) - julianday(started_at)) * 86400 AS INTEGER
          )
      WHERE ended_at = ''
    `).run(closedAt, closedAt);

    // Close open cowork sessions
    db.prepare(`
      UPDATE cowork_sessions
      SET ended_at = ?
      WHERE ended_at IS NULL
    `).run(closedAt);
  });
  close();
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

/**
 * Returns daily session counts for the last 7 days (rolling window ending today).
 * Queries code_sessions and cowork_sessions independently, then merges by date
 * to avoid JOIN pitfalls between unrelated tables.
 */
export function queryWeeklyActivity(db: Database.Database): DailyActivity[] {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const codeDays = db.prepare<[string, string], { date: string; cnt: number; cost: number | null }>(`
    SELECT DATE(started_at) as date, COUNT(*) as cnt, SUM(cost_usd) as cost
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, '-6 days')
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
  `).all(today, today);

  const coworkDays = db.prepare<[string, string], { date: string; cnt: number; turns: number | null }>(`
    SELECT DATE(started_at) as date, COUNT(*) as cnt, SUM(turn_count) as turns
    FROM cowork_sessions
    WHERE DATE(started_at) >= DATE(?, '-6 days')
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
  `).all(today, today);

  // Build a map for all 7 days, filling gaps with zeros
  const codeMap = new Map(codeDays.map(r => [r.date, r]));
  const coworkMap = new Map(coworkDays.map(r => [r.date, r]));

  const result: DailyActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const code = codeMap.get(dateStr);
    const cowork = coworkMap.get(dateStr);
    result.push({
      date: dateStr,
      codeCount: code?.cnt ?? 0,
      coworkCount: cowork?.cnt ?? 0,
      codeCost: code?.cost ?? 0,
      coworkTurns: cowork?.turns ?? 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Table counts
// ---------------------------------------------------------------------------

/**
 * Returns row counts for each data table (for Settings > Data display).
 */
export function queryTableCounts(db: Database.Database): Record<string, number> {
  const tables = [
    'app_sessions',
    'code_sessions',
    'cowork_sessions',
    'cowork_turns',
    'chat_conversations',
    'app_focus_events',
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get() as { cnt: number };
    counts[table] = row.cnt;
  }
  return counts;
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

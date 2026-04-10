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
  CacheEfficiencyData,
  CodeSession,
  CoworkSession,
  CoworkTurn,
  DailyActivity,
  DailyCostData,
  HeatmapDay,
  ModelMixDay,
  ProjectTimelineRow,
  SessionDensityDay,
  TodaySummary,
  TimelineEntry,
  TurnDurationDay,
  UsagePatternsData,
  DateRange,
  ChatConversationCount,
  ChatStats,
  ChatProject,
  ChatMemoryEntry,
  ChatDayCount,
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
 * Inserts an app focus event with dedup (skip if a row within 5s already exists).
 */
export function insertAppFocusEvent(
  db: Database.Database,
  focusedAt: string,
  gapSinceLastMs: number
): boolean {
  const result = db.prepare(`
    INSERT INTO app_focus_events (focused_at, gap_since_last_ms)
    SELECT ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM app_focus_events
      WHERE ABS(julianday(focused_at) - julianday(?)) * 86400 < 5
    )
  `).run(focusedAt, gapSinceLastMs, focusedAt);
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

/**
 * Returns daily heatmap data for the last `days` days (default 365),
 * with cowork session counts and code token breakdowns.
 * Used by the Usage Heatmap view (CGUI-23).
 */
export function queryHeatmapData(
  db: Database.Database,
  days: number = 365
): HeatmapDay[] {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  const codeDays = db.prepare<[string, string], {
    date: string; cnt: number;
    input_tok: number | null; output_tok: number | null;
    cache_read_tok: number | null; cache_create_tok: number | null;
  }>(`
    SELECT DATE(started_at) as date, COUNT(*) as cnt,
           SUM(COALESCE(input_tokens, 0)) as input_tok,
           SUM(COALESCE(output_tokens, 0)) as output_tok,
           SUM(COALESCE(cache_read_tokens, 0)) as cache_read_tok,
           SUM(COALESCE(cache_creation_tokens, 0)) as cache_create_tok
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
  `).all(today, today);

  const coworkDays = db.prepare<[string, string], { date: string; cnt: number }>(`
    SELECT DATE(started_at) as date, COUNT(*) as cnt
    FROM cowork_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
  `).all(today, today);

  const codeMap = new Map(codeDays.map(r => [r.date, r]));
  const coworkMap = new Map(coworkDays.map(r => [r.date, r]));

  const result: HeatmapDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const code = codeMap.get(dateStr);
    const cowork = coworkMap.get(dateStr);
    result.push({
      date: dateStr,
      coworkCount: cowork?.cnt ?? 0,
      codeCount: code?.cnt ?? 0,
      inputTokens: code?.input_tok ?? 0,
      outputTokens: code?.output_tok ?? 0,
      cacheReadTokens: code?.cache_read_tok ?? 0,
      cacheCreationTokens: code?.cache_create_tok ?? 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cache Efficiency
// ---------------------------------------------------------------------------

/**
 * Returns per-project cache efficiency ratios for the last `days` days.
 *
 * - efficiencyPct: cache_read / (cache_read + input) — how much of the input
 *   context was served from cache.
 * - reuseRatio: cache_read / cache_write — how many times each cached byte
 *   was reused (higher = better ROI on cache writes).
 * - estimatedSavingsUsd: cost saved by reading from cache instead of paying
 *   the full input rate. Computed per-session using model-specific pricing,
 *   then summed per project.
 *
 * Top 10 projects by reuse ratio.
 */
export function queryCacheEfficiency(
  db: Database.Database,
  days: number = 30
): CacheEfficiencyData[] {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  // Aggregate token totals per project
  const rows = db.prepare<[string, string], {
    project_path: string | null;
    cache_read: number;
    cache_write: number;
    input: number;
    cnt: number;
  }>(`
    SELECT project_path,
           SUM(COALESCE(cache_read_tokens, 0)) as cache_read,
           SUM(COALESCE(cache_creation_tokens, 0)) as cache_write,
           SUM(COALESCE(input_tokens, 0)) as input,
           COUNT(*) as cnt
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY project_path
    HAVING (cache_read + input) > 0
    ORDER BY CASE WHEN cache_write > 0
               THEN CAST(cache_read AS REAL) / cache_write
               ELSE 0 END DESC
  `).all(today, today);

  // Per-session savings: cache_read_tokens * (inputRate - cacheReadRate) / 1M
  // Grouped by project to avoid per-row iteration in JS.
  const savingsRows = db.prepare<[string, string], {
    project_path: string | null;
    savings: number | null;
  }>(`
    SELECT project_path,
           SUM(
             COALESCE(cache_read_tokens, 0) *
             CASE model
               WHEN 'claude-opus-4-6'           THEN (5.0 - 0.5)  / 1000000.0
               WHEN 'claude-sonnet-4-6'         THEN (3.0 - 0.3)  / 1000000.0
               WHEN 'claude-haiku-4-5-20251001' THEN (1.0 - 0.1)  / 1000000.0
               ELSE (3.0 - 0.3) / 1000000.0
             END
           ) as savings
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY project_path
  `).all(today, today);

  const savingsMap = new Map(savingsRows.map(r => [r.project_path, r.savings ?? 0]));

  return rows.map(r => {
    const denominator = r.cache_read + r.input;
    return {
      project: formatProjectPath(r.project_path),
      efficiencyPct: Math.round((r.cache_read / denominator) * 10000) / 100,
      reuseRatio: r.cache_write > 0
        ? Math.round((r.cache_read / r.cache_write) * 100) / 100
        : 0,
      cacheReadTokens: r.cache_read,
      cacheWriteTokens: r.cache_write,
      inputTokens: r.input,
      estimatedSavingsUsd: Math.round((savingsMap.get(r.project_path) ?? 0) * 100) / 100,
      sessionCount: r.cnt,
    };
  });
}

function formatProjectPath(p: string | null): string {
  if (!p) return '(unknown)';
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.length <= 2 ? parts.join('/') : parts.slice(-2).join('/');
}

// ---------------------------------------------------------------------------
// Turn Duration Trend
// ---------------------------------------------------------------------------

/**
 * Returns daily average Cowork turn duration for the last `days` days.
 * Only includes completed turns (ended_at != '' and duration_seconds > 0).
 * Days with no turns are included with zero values so the chart has no gaps.
 */
export function queryTurnDurationTrend(
  db: Database.Database,
  days: number = 30
): TurnDurationDay[] {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  const rows = db.prepare<[string, string], {
    date: string;
    avg_dur: number;
    cnt: number;
  }>(`
    SELECT DATE(started_at) as date,
           AVG(duration_seconds) as avg_dur,
           COUNT(*) as cnt
    FROM cowork_turns
    WHERE ended_at != ''
      AND duration_seconds > 0
      AND DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `).all(today, today);

  const dataMap = new Map(rows.map(r => [r.date, r]));

  const result: TurnDurationDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      avgDurationSeconds: row ? Math.round(row.avg_dur) : 0,
      turnCount: row?.cnt ?? 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Daily Costs
// ---------------------------------------------------------------------------

/**
 * Returns daily cost totals for the last `days` days from code_sessions.
 * Fetches `days + 7` extra days so the caller can compute a "prior 7d"
 * comparison window. Days with no sessions are filled with zero.
 */
export function queryDailyCosts(
  db: Database.Database,
  days: number = 30
): DailyCostData[] {
  const totalDays = days + 7; // extra week for prior-period comparison
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${totalDays - 1} days'`;

  const rows = db.prepare<[string, string], {
    date: string;
    cost: number;
    cnt: number;
  }>(`
    SELECT DATE(started_at) as date,
           SUM(COALESCE(cost_usd, 0)) as cost,
           COUNT(*) as cnt
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at)
    ORDER BY date ASC
  `).all(today, today);

  const dataMap = new Map(rows.map(r => [r.date, r]));

  const result: DailyCostData[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      costUsd: row ? Math.round(row.cost * 10000) / 10000 : 0,
      sessionCount: row?.cnt ?? 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Session Density
// ---------------------------------------------------------------------------

/**
 * Returns daily session density (sessions per active hour) for the last
 * `days` days. Active hours = time span between first and last session
 * start on that day (across both code and cowork). Days with < 1 hour
 * of span get density = sessionCount (assume 1 hour minimum).
 */
export function querySessionDensity(
  db: Database.Database,
  days: number = 30
): SessionDensityDay[] {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  // Combine code and cowork session timestamps, then compute span per day
  const rows = db.prepare<[string, string, string, string], {
    date: string;
    cnt: number;
    earliest: string;
    latest: string;
  }>(`
    SELECT date, COUNT(*) as cnt, MIN(started_at) as earliest, MAX(started_at) as latest
    FROM (
      SELECT DATE(started_at) as date, started_at FROM code_sessions
      WHERE DATE(started_at) >= DATE(?, ${daysBack}) AND DATE(started_at) <= DATE(?)
      UNION ALL
      SELECT DATE(started_at) as date, started_at FROM cowork_sessions
      WHERE DATE(started_at) >= DATE(?, ${daysBack}) AND DATE(started_at) <= DATE(?)
    )
    GROUP BY date
    ORDER BY date ASC
  `).all(today, today, today, today);

  const dataMap = new Map(rows.map(r => {
    const spanMs = new Date(r.latest).getTime() - new Date(r.earliest).getTime();
    const activeHours = Math.max(1, spanMs / (1000 * 60 * 60));
    return [r.date, {
      sessionCount: r.cnt,
      activeHours: Math.round(activeHours * 100) / 100,
      density: Math.round((r.cnt / activeHours) * 100) / 100,
    }];
  }));

  const result: SessionDensityDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = dataMap.get(dateStr);
    result.push({
      date: dateStr,
      sessionCount: row?.sessionCount ?? 0,
      activeHours: row?.activeHours ?? 0,
      density: row?.density ?? 0,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Model Mix
// ---------------------------------------------------------------------------

/**
 * Returns daily model usage breakdown for code sessions over the last
 * `days` days. Each day has dynamic keys for each model name with the
 * session count as the value. Also returns the distinct model list so
 * the renderer knows which series to render.
 */
export function queryModelMix(
  db: Database.Database,
  days: number = 30
): { days: ModelMixDay[]; models: string[] } {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  const rows = db.prepare<[string, string], {
    date: string;
    model: string | null;
    cnt: number;
  }>(`
    SELECT DATE(started_at) as date,
           COALESCE(model, 'unknown') as model,
           COUNT(*) as cnt
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY DATE(started_at), model
    ORDER BY date ASC
  `).all(today, today);

  // Collect all distinct models
  const modelSet = new Set<string>();
  const dayMap = new Map<string, Record<string, number>>();

  for (const r of rows) {
    modelSet.add(r.model ?? 'unknown');
    const entry = dayMap.get(r.date) ?? {};
    entry[r.model ?? 'unknown'] = r.cnt;
    dayMap.set(r.date, entry);
  }

  const models = Array.from(modelSet).sort();

  // Fill all days, zero-fill missing models
  const result: ModelMixDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = dayMap.get(dateStr) ?? {};
    const day: ModelMixDay = { date: dateStr };
    for (const m of models) {
      day[m] = entry[m] ?? 0;
    }
    result.push(day);
  }

  return { days: result, models };
}

// ---------------------------------------------------------------------------
// Project Timeline
// ---------------------------------------------------------------------------

/**
 * Returns per-project active dates for the last `days` days.
 * Each project gets a list of dates it had at least one code session.
 * Also returns the full date range array for the renderer to lay out columns.
 * Sorted by session count descending. Pagination handled by renderer.
 */
export function queryProjectTimeline(
  db: Database.Database,
  days: number = 30
): { rows: ProjectTimelineRow[]; dateRange: string[] } {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  const rows = db.prepare<[string, string], {
    project_path: string | null;
    date: string;
  }>(`
    SELECT project_path, DATE(started_at) as date
    FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack})
      AND DATE(started_at) <= DATE(?)
    GROUP BY project_path, DATE(started_at)
    ORDER BY project_path, date
  `).all(today, today);

  // Group by project
  const projectMap = new Map<string, Set<string>>();
  const countMap = new Map<string, number>();
  for (const r of rows) {
    const key = formatProjectPath(r.project_path);
    if (!projectMap.has(key)) projectMap.set(key, new Set());
    projectMap.get(key)!.add(r.date);
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Sort by session count descending
  const sorted = Array.from(projectMap.entries())
    .sort((a, b) => (countMap.get(b[0]) ?? 0) - (countMap.get(a[0]) ?? 0));

  const projectRows: ProjectTimelineRow[] = sorted.map(([project, dates]) => ({
    project,
    activeDates: Array.from(dates).sort(),
  }));

  // Full date range
  const dateRange: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateRange.push(d.toISOString().slice(0, 10));
  }

  return { rows: projectRows, dateRange };
}

// ---------------------------------------------------------------------------
// Usage Patterns
// ---------------------------------------------------------------------------

/**
 * Computes usage pattern statistics for the last `days` days.
 * Combines code and cowork sessions for hourly/daily distribution,
 * streaks, and averages.
 */
export function queryUsagePatterns(
  db: Database.Database,
  days: number = 30
): UsagePatternsData {
  const today = new Date().toISOString().slice(0, 10);
  const daysBack = `'-${days - 1} days'`;

  // All session timestamps and costs within range
  const sessions = db.prepare<[string, string, string, string], {
    started_at: string;
    cost: number;
  }>(`
    SELECT started_at, COALESCE(cost_usd, 0) as cost FROM code_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack}) AND DATE(started_at) <= DATE(?)
    UNION ALL
    SELECT started_at, 0 as cost FROM cowork_sessions
    WHERE DATE(started_at) >= DATE(?, ${daysBack}) AND DATE(started_at) <= DATE(?)
  `).all(today, today, today, today);

  // Hourly distribution (0-23)
  const hourly = new Array(24).fill(0);
  // Daily distribution (0=Sun..6=Sat)
  const daily = new Array(7).fill(0);
  // Dates with activity
  const activeDateSet = new Set<string>();
  let totalCost = 0;

  for (const s of sessions) {
    const d = new Date(s.started_at);
    hourly[d.getHours()]++;
    daily[d.getDay()]++;
    activeDateSet.add(s.started_at.slice(0, 10));
    totalCost += s.cost;
  }

  const totalSessions = sessions.length;
  const totalActiveDays = activeDateSet.size;

  // Peak hour and day
  const peakHour = hourly.indexOf(Math.max(...hourly));
  const peakDay = daily.indexOf(Math.max(...daily));

  // Averages
  const avgSessionsPerDay = totalActiveDays > 0
    ? Math.round((totalSessions / totalActiveDays) * 10) / 10
    : 0;
  const avgCostPerDay = totalActiveDays > 0
    ? Math.round((totalCost / totalActiveDays) * 100) / 100
    : 0;

  // Streaks — consecutive calendar days with sessions
  const activeDates = Array.from(activeDateSet).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  // Build full date list and check consecutiveness
  const allDates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    allDates.push(d.toISOString().slice(0, 10));
  }

  for (const dateStr of allDates) {
    if (activeDateSet.has(dateStr)) {
      streak++;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
    }
  }

  // Current streak: count backwards from today (or yesterday if today has no data yet)
  currentStreak = 0;
  for (let i = allDates.length - 1; i >= 0; i--) {
    if (activeDateSet.has(allDates[i])) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    hourlyDistribution: hourly,
    dailyDistribution: daily,
    peakHour,
    peakDay,
    currentStreak,
    longestStreak,
    avgSessionsPerDay,
    avgCostPerDay,
    totalSessions,
    totalActiveDays,
  };
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
// Chat History
// ---------------------------------------------------------------------------

/**
 * Returns conversation counts grouped by week or month.
 * Week periods start on Monday (ISO week). Month periods are first of month.
 */
export function queryChatConversationCounts(
  db: Database.Database,
  groupBy: 'week' | 'month'
): ChatConversationCount[] {
  const dateTrunc =
    groupBy === 'week'
      ? "date(created_at, 'weekday 1', '-7 days')"
      : "date(created_at, 'start of month')";

  const stmt = db.prepare(`
    SELECT ${dateTrunc} AS period, COUNT(*) AS count
    FROM chat_conversations
    WHERE created_at IS NOT NULL
    GROUP BY period
    ORDER BY period ASC
  `);

  return stmt.all() as ChatConversationCount[];
}

/**
 * Returns aggregate stats across all imported chat data.
 */
export function queryChatStats(db: Database.Database): ChatStats {
  const conv = db.prepare(`
    SELECT COUNT(*) AS total, COALESCE(AVG(message_count), 0) AS avg_msgs
    FROM chat_conversations
  `).get() as { total: number; avg_msgs: number };

  const proj = db.prepare(`
    SELECT COUNT(*) AS total FROM chat_projects
  `).get() as { total: number };

  const mem = db.prepare(`
    SELECT COALESCE(SUM(content_length), 0) AS total_bytes FROM chat_memories
  `).get() as { total_bytes: number };

  return {
    totalConversations: conv.total,
    totalProjects: proj.total,
    avgMessagesPerConversation: Math.round(conv.avg_msgs * 10) / 10,
    totalMemoryBytes: mem.total_bytes,
  };
}

/**
 * Returns all imported projects with lifespan in days.
 */
export function queryChatProjects(db: Database.Database): ChatProject[] {
  const stmt = db.prepare(`
    SELECT project_id, name, description, is_private, doc_count, created_at, updated_at,
           MAX(1, CAST(ROUND(julianday(updated_at) - julianday(created_at)) AS INTEGER)) AS lifespan_days
    FROM chat_projects
    ORDER BY updated_at DESC
  `);
  return stmt.all() as ChatProject[];
}

/**
 * Returns all memory entries with project name joined where applicable.
 */
export function queryChatMemories(db: Database.Database): ChatMemoryEntry[] {
  const stmt = db.prepare(`
    SELECT m.type,
           CASE WHEN m.project_id = '' THEN NULL ELSE m.project_id END AS project_id,
           p.name AS project_name,
           m.content_length
    FROM chat_memories m
    LEFT JOIN chat_projects p ON m.project_id != '' AND m.project_id = p.project_id
    ORDER BY m.content_length DESC
  `);
  return stmt.all() as ChatMemoryEntry[];
}

/**
 * Returns daily conversation counts for heatmap display.
 */
export function queryChatConversationHeatmap(
  db: Database.Database,
  days: number
): ChatDayCount[] {
  const stmt = db.prepare(`
    SELECT date(created_at) AS date, COUNT(*) AS count
    FROM chat_conversations
    WHERE created_at >= date('now', '-' || ? || ' days')
    GROUP BY date(created_at)
    ORDER BY date ASC
  `);
  return stmt.all(days) as ChatDayCount[];
}

/**
 * Returns daily project activity counts for heatmap display.
 * Counts projects whose updated_at falls on each day.
 */
export function queryChatProjectHeatmap(
  db: Database.Database,
  days: number
): ChatDayCount[] {
  const stmt = db.prepare(`
    SELECT date(updated_at) AS date, COUNT(*) AS count
    FROM chat_projects
    WHERE updated_at >= date('now', '-' || ? || ' days')
    GROUP BY date(updated_at)
    ORDER BY date ASC
  `);
  return stmt.all(days) as ChatDayCount[];
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

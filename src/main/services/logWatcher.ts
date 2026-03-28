/**
 * Log Watcher service — Tier 1 collection.
 * Tails the Claude Desktop main.log file using chokidar for file watching
 * and readline for line-by-line parsing. Not implemented until v0.2.
 *
 * @see §2.1 of architecture doc for full specification
 */

import { EventEmitter } from 'events';
import type Database from 'better-sqlite3';
import type { LogEvent } from '../../shared/ipc-types';

/** Events emitted by LogWatcher */
export interface LogWatcherEvents {
  event: (logEvent: LogEvent) => void;
  error: (err: Error) => void;
  connected: () => void;
  disconnected: () => void;
}

/**
 * LogWatcher monitors the Claude Desktop main.log file and emits typed
 * LogEvent objects as new lines are written. Deduplicates events using
 * (event_type, session_id, timestamp) composite key before database insertion.
 *
 * Not implemented until v0.2 — constructor and methods are stubs.
 */
export class LogWatcher extends EventEmitter {
  private readonly db: Database.Database;
  private logFilePath: string | null = null;
  private isWatching: boolean = false;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  /**
   * Starts watching the log file. Auto-discovers the path via glob
   * (Claude_* package pattern) if logFilePath is null.
   *
   * @see §2.1 "Log file path" and OQ-2 in architecture doc
   */
  async start(logFilePath?: string): Promise<void> {
    // TODO: implement (v0.2)
    // 1. If logFilePath provided, use it. Otherwise auto-discover via:
    //    glob('%LOCALAPPDATA%/Packages/Claude_*/LocalCache/Roaming/Claude/logs/main.log')
    // 2. Verify path exists — if not, emit 'disconnected' and return
    // 3. Start chokidar watcher on the file
    // 4. On initial attach: do a full-file backfill (FR-1.10) via readline
    //    to catch events from when the app was not running
    // 5. On chokidar 'change': read new lines from last known position (tail mode)
    // 6. On chokidar 'unlink'/'add' (file rotation): re-open new file from start
    // 7. Set isWatching = true and emit 'connected'
    console.log('[logWatcher] start() called — not implemented until v0.2');
  }

  /**
   * Stops the file watcher and cleans up readline/chokidar instances.
   */
  async stop(): Promise<void> {
    // TODO: implement (v0.2)
    this.isWatching = false;
    console.log('[logWatcher] stop() called — not implemented until v0.2');
  }

  /**
   * Parses a single log line and returns a typed LogEvent or null if the
   * line does not match any known pattern.
   *
   * @see §2.1 "Captured event patterns" table in architecture doc
   */
  parseLine(line: string): LogEvent | null {
    // TODO: implement (v0.2)
    // Match against patterns defined in §2.1:
    // - 'Starting app {' → app_launch
    // - 'beforeQuit: handler fired' → app_quit
    // - 'LocalAgentModeSessions.start:' → cowork_session_created
    // - 'Lifecycle: ... initializing → running' → cowork_turn_started
    // - '[Result] Turn succeeded for session X' → cowork_turn_completed
    // - 'Lifecycle: ... running → idle' → cowork_turn_ended
    // - '[SkillsPlugin] Window focused' → app_focus
    return null;
  }

  /**
   * Returns whether the watcher is currently active.
   */
  get watching(): boolean {
    return this.isWatching;
  }
}

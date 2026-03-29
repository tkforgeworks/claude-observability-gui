/**
 * Log Watcher service — Tier 1 collection.
 * Tails the Claude Desktop main.log file using chokidar for file watching
 * and fs.createReadStream + readline for line-by-line reading.
 *
 * Each line is parsed via logLineParser. Matched events are emitted as typed
 * LogEvent objects and persisted to SQLite. Unmatched structured lines are
 * written to a rotating debug log file.
 *
 * @see §2.1 of architecture doc for full specification
 * @see CGUI-13 (tailing), CGUI-14 (parsing)
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import readline from 'readline';
import chokidar from 'chokidar';
import type Database from 'better-sqlite3';
import type { LogEvent } from '../../shared/ipc-types';
import { getLogPathStatus } from './logPathDiscovery';
import { parseLogEvent, isStructuredLine } from './logLineParser';
import { writeUnmatchedLine } from './unmatchedLogWriter';
import {
  insertAppLaunch,
  closeAppSession,
  upsertCoworkSession,
  updateCoworkSessionCliId,
  insertCoworkTurn,
  completeCoworkTurn,
} from '../db/queries';

/** Events emitted by LogWatcher */
export interface LogWatcherEvents {
  event: (logEvent: LogEvent) => void;
  error: (err: Error) => void;
  connected: (path: string) => void;
  disconnected: (reason: string) => void;
}

/**
 * LogWatcher monitors the Claude Desktop main.log file and emits typed
 * LogEvent objects as new lines are written. Persists app lifecycle events
 * to SQLite. Unmatched lines go to a rotating debug log.
 */
export class LogWatcher extends EventEmitter {
  private readonly db: Database.Database;
  private logFilePath: string | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isWatching: boolean = false;
  private fileOffset: number = 0;
  private reading: boolean = false;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  /**
   * Starts watching the log file. Uses the path from logPathDiscovery
   * (CGUI-12) unless an explicit path is provided.
   */
  async start(logFilePath?: string): Promise<void> {
    if (this.isWatching) {
      console.log('[logWatcher] Already watching, ignoring start()');
      return;
    }

    // Resolve the log file path
    if (logFilePath) {
      this.logFilePath = logFilePath;
    } else {
      const status = getLogPathStatus();
      if (!status.valid || !status.path) {
        const reason = status.source === 'not-found'
          ? 'Claude Desktop log not found — is Claude Desktop installed?'
          : `Log path invalid: ${status.path}`;
        console.warn(`[logWatcher] ${reason}`);
        this.emit('disconnected', reason);
        return;
      }
      this.logFilePath = status.path;
    }

    // Verify the file exists
    if (!fs.existsSync(this.logFilePath)) {
      const reason = `Log file does not exist: ${this.logFilePath}`;
      console.warn(`[logWatcher] ${reason}`);
      this.emit('disconnected', reason);
      return;
    }

    // Seek to end of file — only tail new content
    try {
      const stat = fs.statSync(this.logFilePath);
      this.fileOffset = stat.size;
      console.log(`[logWatcher] Starting at offset ${this.fileOffset} (${this.logFilePath})`);
    } catch (err) {
      console.error('[logWatcher] Failed to stat log file:', err);
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return;
    }

    // Start chokidar watcher — use polling because fs.watch does not
    // receive change notifications for files inside MSIX package directories
    this.watcher = chokidar.watch(this.logFilePath, {
      persistent: true,
      usePolling: true,
      interval: 1000,
    });

    this.watcher.on('change', (filePath) => {
      this.readNewLines(filePath);
    });

    this.watcher.on('unlink', () => {
      // File was deleted — likely log rotation
      console.log('[logWatcher] Log file removed (rotation detected), waiting for new file...');
    });

    this.watcher.on('add', (filePath) => {
      // New file appeared at the same path — rotation complete
      console.log('[logWatcher] New log file detected after rotation, resetting offset to 0');
      this.fileOffset = 0;
      this.readNewLines(filePath);
    });

    this.watcher.on('error', (err) => {
      console.error('[logWatcher] Chokidar error:', err);
      this.emit('error', err);
    });

    this.isWatching = true;
    console.log(`[logWatcher] Connected — tailing ${this.logFilePath}`);
    this.emit('connected', this.logFilePath);
  }

  /**
   * Reads new bytes from the log file starting at the last known offset,
   * splits into lines, parses each, and routes to the appropriate handler.
   */
  private readNewLines(filePath: string): void {
    if (this.reading) return; // Prevent overlapping reads
    this.reading = true;

    let currentSize: number;
    try {
      const stat = fs.statSync(filePath);
      currentSize = stat.size;
    } catch {
      this.reading = false;
      return; // File may have been deleted during rotation
    }

    // File was truncated or rotated — reset to beginning
    if (currentSize < this.fileOffset) {
      console.log(`[logWatcher] File size shrank (${this.fileOffset} → ${currentSize}), resetting offset`);
      this.fileOffset = 0;
    }

    // Nothing new to read
    if (currentSize === this.fileOffset) {
      this.reading = false;
      return;
    }

    const stream = fs.createReadStream(filePath, {
      start: this.fileOffset,
      end: currentSize - 1,
      encoding: 'utf-8',
    });

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      this.processLine(line);
    });

    rl.on('close', () => {
      this.fileOffset = currentSize;
      this.reading = false;
    });

    rl.on('error', (err) => {
      console.error('[logWatcher] Readline error:', err);
      this.reading = false;
    });
  }

  /**
   * Processes a single line: parse, persist if matched, or write to
   * unmatched log if it's a structured line that didn't match.
   */
  private processLine(line: string): void {
    const event = parseLogEvent(line);

    if (event) {
      console.log(`[logWatcher:parsed] ${event.type} @ ${event.timestamp}`);
      this.handleEvent(event);
      this.emit('event', event);
      return;
    }

    // Only log structured lines (with timestamp prefix) to unmatched file.
    // Multi-line continuations (JSON bodies etc.) are silently dropped.
    if (isStructuredLine(line)) {
      writeUnmatchedLine(line);
    }
  }

  /**
   * Persists a parsed event to SQLite.
   */
  private handleEvent(event: LogEvent): void {
    try {
      switch (event.type) {
        case 'app_launch':
          insertAppLaunch(this.db, event.timestamp);
          break;
        case 'app_quit':
          closeAppSession(this.db, event.timestamp);
          break;
        case 'cowork_session_created':
          upsertCoworkSession(this.db, event.sessionId!, event.timestamp);
          break;
        case 'cowork_session_cli_mapped':
          updateCoworkSessionCliId(
            this.db,
            event.sessionId!,
            event.data!.cliSessionId as string
          );
          break;
        case 'cowork_turn_started':
          insertCoworkTurn(this.db, event.sessionId!, event.timestamp);
          break;
        case 'cowork_turn_ended':
          completeCoworkTurn(this.db, event.sessionId!, event.timestamp);
          break;
        // cowork_turn_completed ([Result] Turn succeeded) is logged but
        // we use turn_ended (running → idle) for timing since it fires after cleanup
      }
    } catch (err) {
      console.error(`[logWatcher] Failed to persist ${event.type}:`, err);
    }
  }

  /**
   * Stops the file watcher and cleans up.
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    this.fileOffset = 0;
    this.logFilePath = null;
    console.log('[logWatcher] Stopped');
    this.emit('disconnected', 'stopped');
  }

  /**
   * Returns whether the watcher is currently active.
   */
  get watching(): boolean {
    return this.isWatching;
  }
}

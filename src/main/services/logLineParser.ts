/**
 * Parses structured log lines from Claude Desktop's main.log into typed events.
 *
 * Log line format: `YYYY-MM-DD HH:MM:SS [level] message`
 * Lines without this prefix are multi-line continuations and are skipped.
 *
 * @see §2.1 "Captured event patterns" in architecture doc
 * @see CGUI-14
 */

import type { LogEvent } from '../../shared/ipc-types';

/** Result of parsing a single log line. */
export interface ParsedLine {
  timestamp: string; // ISO 8601
  level: string;
  message: string;
}

// Matches: 2026-03-29 11:06:29 [info] message text here
const LOG_LINE_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/;

/**
 * Extracts timestamp, level, and message from a structured log line.
 * Returns null for multi-line continuations (lines without the timestamp prefix).
 */
export function parseLogLine(line: string): ParsedLine | null {
  const match = LOG_LINE_RE.exec(line);
  if (!match) return null;

  const [, dateTime, level, message] = match;
  // Convert "2026-03-29 11:06:29" to ISO 8601 with local timezone assumption
  const timestamp = dateTime.replace(' ', 'T');

  return { timestamp, level, message };
}

// ---------------------------------------------------------------------------
// Event matchers — each returns a LogEvent or null
// ---------------------------------------------------------------------------

/**
 * Matches: `Starting app {`
 * Indicates Claude Desktop launched.
 */
function matchAppLaunch(parsed: ParsedLine): LogEvent | null {
  if (!parsed.message.startsWith('Starting app {')) return null;
  return {
    type: 'app_launch',
    timestamp: parsed.timestamp,
  };
}

/**
 * Matches: `beforeQuit: handler fired, going down` (first occurrence only).
 * The beforeQuit handler fires twice during shutdown — once to start cleanup
 * and once after cleanup completes. We match both but dedup happens in the
 * DB layer (closeAppSession updates only the most recent open session).
 */
function matchAppQuit(parsed: ParsedLine): LogEvent | null {
  if (!parsed.message.startsWith('beforeQuit:')) return null;
  return {
    type: 'app_quit',
    timestamp: parsed.timestamp,
  };
}

// Registry of matchers — checked in order, first match wins
const matchers: Array<(parsed: ParsedLine) => LogEvent | null> = [
  matchAppLaunch,
  matchAppQuit,
];

/**
 * Attempts to parse a raw log line into a typed LogEvent.
 * Returns null if the line is a continuation or doesn't match any known pattern.
 */
export function parseLogEvent(line: string): LogEvent | null {
  const parsed = parseLogLine(line);
  if (!parsed) return null; // Multi-line continuation

  for (const matcher of matchers) {
    const event = matcher(parsed);
    if (event) return event;
  }

  return null;
}

/**
 * Returns true if the line has a valid timestamp prefix (i.e., it's a
 * structured log line, not a multi-line continuation).
 */
export function isStructuredLine(line: string): boolean {
  return LOG_LINE_RE.test(line);
}

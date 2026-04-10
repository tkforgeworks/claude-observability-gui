/**
 * Parses structured log lines from Claude Desktop's main.log into typed events.
 *
 * Log line format: `YYYY-MM-DD HH:MM:SS [level] message`
 * Lines without this prefix are multi-line continuations and are skipped.
 *
 * @see §2.1 "Captured event patterns" in architecture doc
 * @see CGUI-14 (app lifecycle), CGUI-15 (cowork session/turn events)
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

// Arrow character appears as either → (UTF-8) or ΓåÆ (Windows cp1252 encoding)
const ARROW_PATTERN = '(?:→|ΓåÆ)';

// Em-dash appears as either — (UTF-8) or ΓÇö (Windows cp1252 encoding)
const EM_DASH_PATTERN = '(?:—|ΓÇö)';

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
 * Matches: `beforeQuit: handler fired, going down`
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

/**
 * Matches: `Starting local session local_xxx in /path/to/project`
 * Indicates a new Cowork session was created.
 */
const SESSION_CREATED_RE = /^Starting local session (local_[\w-]+) in (.+)$/;

function matchCoworkSessionCreated(parsed: ParsedLine): LogEvent | null {
  const match = SESSION_CREATED_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'cowork_session_created',
    timestamp: parsed.timestamp,
    sessionId: match[1],
    data: { projectPath: match[2] },
  };
}

/**
 * Matches: `Mapping internal session local_xxx to CLI session yyy`
 * Links a Cowork session to its CLI session ID.
 */
const CLI_MAPPED_RE = /^Mapping internal session (local_[\w-]+) to CLI session ([\w-]+)$/;

function matchCoworkSessionCliMapped(parsed: ParsedLine): LogEvent | null {
  const match = CLI_MAPPED_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'cowork_session_cli_mapped',
    timestamp: parsed.timestamp,
    sessionId: match[1],
    data: { cliSessionId: match[2] },
  };
}

/**
 * Matches: `[Lifecycle] Session local_xxx: idle → initializing`
 * Indicates the user sent a message and a turn is starting.
 */
const TURN_STARTED_RE = new RegExp(
  `^\\[Lifecycle\\] Session (local_[\\w-]+): idle ${ARROW_PATTERN} initializing$`
);

function matchCoworkTurnStarted(parsed: ParsedLine): LogEvent | null {
  const match = TURN_STARTED_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'cowork_turn_started',
    timestamp: parsed.timestamp,
    sessionId: match[1],
  };
}

/**
 * Matches: `[Result] Turn succeeded for session local_xxx`
 * Indicates the model finished responding successfully.
 */
const TURN_COMPLETED_RE = /^\[Result\] Turn succeeded for session (local_[\w-]+)$/;

function matchCoworkTurnCompleted(parsed: ParsedLine): LogEvent | null {
  const match = TURN_COMPLETED_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'cowork_turn_completed',
    timestamp: parsed.timestamp,
    sessionId: match[1],
  };
}

/**
 * Matches: `[Lifecycle] Session local_xxx: running → idle`
 * Indicates the turn has fully ended (after cleanup).
 */
const TURN_ENDED_RE = new RegExp(
  `^\\[Lifecycle\\] Session (local_[\\w-]+): running ${ARROW_PATTERN} idle$`
);

function matchCoworkTurnEnded(parsed: ParsedLine): LogEvent | null {
  const match = TURN_ENDED_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'cowork_turn_ended',
    timestamp: parsed.timestamp,
    sessionId: match[1],
  };
}

/**
 * Matches: `[SkillsPlugin] Window focused — polling now (last poll was 2490335ms ago)`
 * Indicates the Claude Desktop window gained focus.
 */
const APP_FOCUS_RE = new RegExp(
  `^\\[SkillsPlugin\\] Window focused ${EM_DASH_PATTERN} polling now \\(last poll was (\\d+)ms ago\\)$`
);

function matchAppFocus(parsed: ParsedLine): LogEvent | null {
  const match = APP_FOCUS_RE.exec(parsed.message);
  if (!match) return null;
  return {
    type: 'app_focus',
    timestamp: parsed.timestamp,
    data: { gapSinceLastMs: parseInt(match[1], 10) },
  };
}

// Registry of matchers — checked in order, first match wins
const matchers: Array<(parsed: ParsedLine) => LogEvent | null> = [
  matchAppLaunch,
  matchAppQuit,
  matchCoworkSessionCreated,
  matchCoworkSessionCliMapped,
  matchCoworkTurnStarted,
  matchCoworkTurnCompleted,
  matchCoworkTurnEnded,
  matchAppFocus,
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

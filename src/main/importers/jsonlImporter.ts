/**
 * JSONL Importer for Claude Code session data.
 * Scans ~/.claude/projects/ recursively, parses JSONL files, aggregates
 * session-level token counts, computes cost, and upserts into SQLite.
 *
 * @see §2.2 of architecture doc for full specification
 */

import type Database from 'better-sqlite3';
import type { ImportSummary } from '../../shared/ipc-types';

/**
 * Represents a single parsed record line from a JSONL file.
 * Discriminated by the `type` field.
 */
export interface JsonlRecord {
  type: 'assistant' | 'user' | 'system' | 'progress' | 'file-history-snapshot';
  sessionId: string;
  timestamp: string;   // ISO 8601
  requestId?: string;
  cwd?: string;
  slug?: string;
  version?: string;
  message?: {
    model?: string;
    stop_reason?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
      cache_creation?: {
        ephemeral_5m_input_tokens?: number;
        ephemeral_1h_input_tokens?: number;
      };
    };
  };
}

/**
 * Session-level aggregated data ready for SQLite insertion.
 */
export interface AggregatedSession {
  sessionId: string;
  projectPath: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheCreation1hTokens: number;
  startedAt: string | null;
  endedAt: string | null;
}

export class JsonlImporter {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Entry point: scans the Claude Code projects directory for JSONL files,
   * parses and aggregates each session, deduplicates against SQLite, and
   * inserts new records.
   *
   * Called on app startup and every 5 minutes.
   *
   * @see §2.2 "JSONL directory path" and "Session-level aggregation"
   */
  async scan(): Promise<ImportSummary> {
    // TODO: implement
    // 1. Resolve projectsDir: settings.claudeCodeDataPath ?? path.join(os.homedir(), '.claude', 'projects')
    // 2. Verify directory exists — if not, return ImportSummary with errorCount: 1
    // 3. Recursively find all *.jsonl files under projectsDir
    //    Include subagent files at {sessionId}/subagents/agent-{agentId}.jsonl
    //    Group subagent files under their parent session ID
    // 4. For each session group, call aggregateSession()
    // 5. Deduplicate against existing code_sessions rows by session_id
    // 6. Insert new sessions; update existing if token counts differ (re-import)
    // 7. Compute cost_usd via costCalculator.calculateCost() for each inserted/updated row
    // 8. Return ImportSummary
    throw new Error('JsonlImporter.scan() not yet implemented');
  }

  /**
   * Reads and parses all lines from a single JSONL file.
   * Skips malformed lines (logs warning, increments error counter).
   */
  async parseFile(filePath: string): Promise<JsonlRecord[]> {
    // TODO: implement
    // 1. Open file with readline interface
    // 2. Parse each line as JSON
    // 3. Validate presence of required fields (type, sessionId, timestamp)
    // 4. Return array of JsonlRecord
    throw new Error('JsonlImporter.parseFile() not yet implemented');
  }

  /**
   * Aggregates all records from a session's JSONL files (including subagent files)
   * into a single AggregatedSession with summed token counts.
   *
   * Key rules:
   * - Only process `assistant` records with stop_reason set (final chunk per requestId)
   * - Sum token counts across all final chunks
   * - Include subagent token usage in parent session totals
   * - Model taken from first assistant record
   * - started_at = earliest timestamp, ended_at = latest timestamp
   *
   * @see §2.2 "Session-level aggregation" and "Subagent token handling"
   */
  aggregateSession(
    sessionId: string,
    records: JsonlRecord[],
    subagentRecords: JsonlRecord[][]
  ): AggregatedSession | null {
    // TODO: implement
    // 1. Merge records + all subagentRecords into a flat list
    // 2. Filter to assistant records only
    // 3. Deduplicate by requestId — keep only the record where stop_reason is set
    // 4. Sum input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens
    //    separately track ephemeral_1h_input_tokens for accurate cost calculation
    // 5. Extract model from first assistant record
    // 6. Determine projectPath from cwd field (most common value across records)
    // 7. Find min/max timestamp across ALL record types for session start/end
    throw new Error('JsonlImporter.aggregateSession() not yet implemented');
  }
}

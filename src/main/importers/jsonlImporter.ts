/**
 * JSONL Importer for Claude Code session data.
 * Scans ~/.claude/projects/ recursively, parses JSONL files, aggregates
 * session-level token counts, computes cost, and upserts into SQLite.
 *
 * @see §2.2 of architecture doc for full specification
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import type Database from 'better-sqlite3';
import type { ImportSummary } from '../../shared/ipc-types';
import { calculateCost } from './costCalculator';
import { loadSettings } from '../config/configStore';

/**
 * Represents a single parsed record line from a JSONL file.
 * Discriminated by the `type` field.
 */
export interface JsonlRecord {
  type: 'assistant' | 'user' | 'system' | 'progress' | 'file-history-snapshot' | 'last-prompt';
  sessionId?: string;
  timestamp?: string;
  requestId?: string;
  cwd?: string;
  slug?: string;
  version?: string;
  message?: {
    model?: string;
    stop_reason?: string | null;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
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
  slug: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  cacheCreation1hTokens: number;
  startedAt: string | null;
  endedAt: string | null;
}

/**
 * Discovered JSONL files grouped by session ID.
 */
interface SessionFiles {
  mainFile: string;
  subagentFiles: string[];
}

export class JsonlImporter {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Entry point: scans the Claude Code projects directory for JSONL files,
   * parses and aggregates each session, deduplicates against SQLite, and
   * upserts records.
   */
  async scan(): Promise<ImportSummary> {
    const startTime = Date.now();
    let newRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let errorCount = 0;

    const settings = loadSettings();
    const projectsDir = settings.claudeCodeDataPath ?? path.join(os.homedir(), '.claude', 'projects');

    if (!fs.existsSync(projectsDir)) {
      console.warn(`[jsonlImporter] Projects directory not found: ${projectsDir}`);
      return {
        newRecords: 0,
        updatedRecords: 0,
        skippedRecords: 0,
        errorCount: 1,
        scanDurationMs: Date.now() - startTime,
        scannedAt: new Date().toISOString(),
      };
    }

    // Discover all JSONL files grouped by session
    const sessionGroups = this.discoverFiles(projectsDir);
    console.log(`[jsonlImporter] Found ${sessionGroups.size} session(s) to process`);

    const upsert = this.db.prepare(`
      INSERT INTO code_sessions (session_id, project_path, model, slug, input_tokens, output_tokens,
        cache_creation_tokens, cache_read_tokens, cost_usd, started_at, ended_at)
      VALUES (@sessionId, @projectPath, @model, @slug, @inputTokens, @outputTokens,
        @cacheCreationTokens, @cacheReadTokens, @costUsd, @startedAt, @endedAt)
      ON CONFLICT(session_id) DO UPDATE SET
        project_path = excluded.project_path,
        model = excluded.model,
        slug = excluded.slug,
        input_tokens = excluded.input_tokens,
        output_tokens = excluded.output_tokens,
        cache_creation_tokens = excluded.cache_creation_tokens,
        cache_read_tokens = excluded.cache_read_tokens,
        cost_usd = excluded.cost_usd,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        synced_to_influx = 0
    `);

    const checkExists = this.db.prepare<[string], { id: number; input_tokens: number | null; output_tokens: number | null }>(
      `SELECT id, input_tokens, output_tokens FROM code_sessions WHERE session_id = ?`
    );

    for (const [sessionId, files] of sessionGroups) {
      try {
        // Parse main file
        const mainRecords = await this.parseFile(files.mainFile);

        // Parse subagent files
        const subagentRecords: JsonlRecord[][] = [];
        for (const subFile of files.subagentFiles) {
          try {
            subagentRecords.push(await this.parseFile(subFile));
          } catch (err) {
            console.error(`[jsonlImporter] Failed to parse subagent file ${subFile}:`, err);
            errorCount++;
          }
        }

        // Aggregate
        const session = this.aggregateSession(sessionId, mainRecords, subagentRecords);
        if (!session) {
          skippedRecords++;
          continue;
        }

        // Compute cost
        let costUsd: number | null = null;
        if (session.model) {
          const costResult = calculateCost(session.model, {
            inputTokens: session.inputTokens,
            outputTokens: session.outputTokens,
            cacheCreationTokens: session.cacheCreationTokens,
            cacheReadTokens: session.cacheReadTokens,
            cacheCreation1hTokens: session.cacheCreation1hTokens,
          });
          costUsd = costResult.modelRecognised ? costResult.costUsd : null;
        }

        // Check if already exists for counting new vs updated
        const existing = checkExists.get(sessionId);

        upsert.run({
          sessionId: session.sessionId,
          projectPath: session.projectPath,
          model: session.model,
          slug: session.slug,
          inputTokens: session.inputTokens,
          outputTokens: session.outputTokens,
          cacheCreationTokens: session.cacheCreationTokens,
          cacheReadTokens: session.cacheReadTokens,
          costUsd,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
        });

        if (existing) {
          if (existing.input_tokens !== session.inputTokens || existing.output_tokens !== session.outputTokens) {
            updatedRecords++;
          } else {
            skippedRecords++;
          }
        } else {
          newRecords++;
        }
      } catch (err) {
        console.error(`[jsonlImporter] Failed to process session ${sessionId}:`, err);
        errorCount++;
      }
    }

    const summary: ImportSummary = {
      newRecords,
      updatedRecords,
      skippedRecords,
      errorCount,
      scanDurationMs: Date.now() - startTime,
      scannedAt: new Date().toISOString(),
    };

    console.log(
      `[jsonlImporter] Scan complete: ${newRecords} new, ${updatedRecords} updated, ${skippedRecords} skipped, ${errorCount} errors (${summary.scanDurationMs}ms)`
    );

    return summary;
  }

  /**
   * Recursively discovers JSONL files and groups them by session ID.
   * Subagent files at {sessionId}/subagents/agent-*.jsonl are grouped
   * under their parent session.
   */
  private discoverFiles(projectsDir: string): Map<string, SessionFiles> {
    const sessions = new Map<string, SessionFiles>();

    const scanDir = (dir: string): void => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Check for subagents directory
          const subagentsDir = path.join(fullPath, 'subagents');
          if (fs.existsSync(subagentsDir)) {
            const sessionId = entry.name;
            const existing = sessions.get(sessionId);
            const subFiles = this.findJsonlFiles(subagentsDir);
            if (existing) {
              existing.subagentFiles.push(...subFiles);
            } else if (subFiles.length > 0) {
              // Subagent dir exists but we haven't found the main file yet —
              // it will be added when we encounter the .jsonl in the parent dir
              sessions.set(sessionId, { mainFile: '', subagentFiles: subFiles });
            }
          }
          scanDir(fullPath);
        } else if (entry.name.endsWith('.jsonl')) {
          const sessionId = entry.name.replace('.jsonl', '');
          // Skip files in subagents directories (handled above)
          if (path.basename(path.dirname(fullPath)) === 'subagents') {
            continue;
          }
          const existing = sessions.get(sessionId);
          if (existing) {
            existing.mainFile = fullPath;
          } else {
            sessions.set(sessionId, { mainFile: fullPath, subagentFiles: [] });
          }
        }
      }
    };

    scanDir(projectsDir);

    // Remove entries that have no main file (orphaned subagent dirs)
    for (const [id, files] of sessions) {
      if (!files.mainFile) {
        sessions.delete(id);
      }
    }

    return sessions;
  }

  private findJsonlFiles(dir: string): string[] {
    try {
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => path.join(dir, f));
    } catch {
      return [];
    }
  }

  /**
   * Reads and parses all lines from a single JSONL file.
   * Skips malformed lines with a warning.
   */
  async parseFile(filePath: string): Promise<JsonlRecord[]> {
    const records: JsonlRecord[] = [];
    const input = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line) as JsonlRecord;
        if (!parsed.type) {
          console.warn(`[jsonlImporter] ${filePath}:${lineNum} — missing 'type' field, skipping`);
          continue;
        }
        records.push(parsed);
      } catch {
        console.warn(`[jsonlImporter] ${filePath}:${lineNum} — malformed JSON, skipping`);
      }
    }

    return records;
  }

  /**
   * Aggregates all records from a session's JSONL files into a single
   * AggregatedSession with summed token counts.
   *
   * Key rules:
   * - Only process assistant records with stop_reason set (final chunk per requestId)
   * - Sum token counts across all final chunks
   * - Include subagent token usage in parent session totals
   * - Model taken from first assistant record
   * - started_at = earliest timestamp, ended_at = latest timestamp
   */
  aggregateSession(
    sessionId: string,
    records: JsonlRecord[],
    subagentRecords: JsonlRecord[][]
  ): AggregatedSession | null {
    // Merge all records for timestamp/cwd/slug extraction
    const allRecords = [...records];
    for (const sub of subagentRecords) {
      allRecords.push(...sub);
    }

    if (allRecords.length === 0) return null;

    // Collect all assistant records (main + subagents) for token aggregation
    const allAssistant = allRecords.filter(r => r.type === 'assistant');

    // Deduplicate by requestId — keep only the record with stop_reason set
    const byRequestId = new Map<string, JsonlRecord>();
    const noRequestId: JsonlRecord[] = [];

    for (const rec of allAssistant) {
      if (!rec.requestId) {
        // Records without requestId — include if they have usage data
        if (rec.message?.usage) {
          noRequestId.push(rec);
        }
        continue;
      }

      const existing = byRequestId.get(rec.requestId);
      if (!existing) {
        byRequestId.set(rec.requestId, rec);
      } else if (rec.message?.stop_reason) {
        // This is the final chunk — replace
        byRequestId.set(rec.requestId, rec);
      }
    }

    const finalChunks = [...byRequestId.values(), ...noRequestId].filter(
      r => r.message?.stop_reason && r.message?.usage
    );

    // Sum tokens
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheCreationTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreation1hTokens = 0;

    for (const rec of finalChunks) {
      const u = rec.message!.usage!;
      inputTokens += u.input_tokens ?? 0;
      outputTokens += u.output_tokens ?? 0;
      cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
      cacheReadTokens += u.cache_read_input_tokens ?? 0;
      cacheCreation1hTokens += u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    }

    // Model from first assistant record with a model field
    let model: string | null = null;
    for (const rec of allAssistant) {
      if (rec.message?.model) {
        model = rec.message.model;
        break;
      }
    }

    // Project path from cwd (most common value)
    const cwdCounts = new Map<string, number>();
    for (const rec of allRecords) {
      if (rec.cwd) {
        cwdCounts.set(rec.cwd, (cwdCounts.get(rec.cwd) ?? 0) + 1);
      }
    }
    let projectPath: string | null = null;
    let maxCount = 0;
    for (const [cwd, count] of cwdCounts) {
      if (count > maxCount) {
        projectPath = cwd;
        maxCount = count;
      }
    }

    // Slug from any record that has it (usually on progress records)
    let slug: string | null = null;
    for (const rec of allRecords) {
      if (rec.slug) {
        slug = rec.slug;
        break;
      }
    }

    // Timestamps — earliest and latest across ALL record types
    let startedAt: string | null = null;
    let endedAt: string | null = null;
    for (const rec of allRecords) {
      if (!rec.timestamp) continue;
      if (!startedAt || rec.timestamp < startedAt) startedAt = rec.timestamp;
      if (!endedAt || rec.timestamp > endedAt) endedAt = rec.timestamp;
    }

    // Skip sessions with no token data at all
    if (inputTokens === 0 && outputTokens === 0 && cacheCreationTokens === 0 && cacheReadTokens === 0) {
      return null;
    }

    return {
      sessionId,
      projectPath,
      model,
      slug,
      inputTokens,
      outputTokens,
      cacheCreationTokens,
      cacheReadTokens,
      cacheCreation1hTokens,
      startedAt,
      endedAt,
    };
  }
}

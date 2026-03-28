/**
 * Domain model interfaces matching the SQLite schema (§3 of architecture doc).
 * One interface per data table. These are used by IPC handlers and query functions.
 */

export interface AppSession {
  id: number;
  launched_at: string; // ISO 8601
  quit_at: string | null;
  duration_seconds: number | null;
  synced_to_influx: number; // 0 = pending, 1 = synced
}

export interface CoworkSession {
  id: number;
  session_id: string; // UNIQUE — internal session UUID from log
  cli_session_id: string | null;
  title: string | null;
  started_at: string; // ISO 8601
  ended_at: string | null;
  turn_count: number;
  synced_to_influx: number;
}

export interface CoworkTurn {
  id: number;
  session_id: string; // FK → cowork_sessions.session_id
  started_at: string; // ISO 8601
  ended_at: string; // ISO 8601
  duration_seconds: number | null;
  synced_to_influx: number;
}

export interface CodeSession {
  id: number;
  session_id: string; // UNIQUE — from JSONL filename
  project_path: string | null;
  model: string | null; // e.g. 'claude-opus-4-6'
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
  cost_usd: number | null; // Computed on import — see §2.4
  started_at: string | null;
  ended_at: string | null;
  synced_to_influx: number;
}

export interface ChatConversation {
  id: number;
  conversation_id: string; // UNIQUE — UUID from claude.ai
  title: string | null;
  message_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  imported_at: string | null; // When this row was upserted
}

export interface AppFocusEvent {
  id: number;
  focused_at: string; // ISO 8601
  gap_since_last_ms: number | null; // From log: 'last poll was Xms ago'
}

export interface MetaRow {
  key: string;
  value: string;
}

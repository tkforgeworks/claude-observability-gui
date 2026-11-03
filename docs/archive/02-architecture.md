# Claude Usage Monitor — Architecture Guide

**Project:** Claude Usage Monitor
**Author:** Tim Klimpel / tkforgeworks
**Date:** March 2026
**Status:** Draft v0.1

---

## Overview

This document describes the system architecture for the Claude Usage Monitor — a Windows Electron application that collects Claude usage data from local sources, stores it in SQLite, displays it in a local dashboard, and optionally syncs to the tkforgeworks homelab Grafana/InfluxDB stack.

---

## 1. System Layers

The system has four layers:

```
┌─────────────────────────────────────────────────────────┐
│  COLLECTION TIER                                        │
│  Log Watcher │ JSONL Importer │ Export Importer         │
└──────────────────────┬──────────────────────────────────┘
                       │ write
┌──────────────────────▼──────────────────────────────────┐
│  STORAGE TIER                                           │
│  SQLite (primary, always-on, local)                     │
└──────────────┬──────────────────────┬───────────────────┘
               │ read                 │ async sync
┌──────────────▼──────┐  ┌────────────▼───────────────────┐
│  PRESENTATION TIER  │  │  REMOTE SYNC TIER               │
│  Electron + React   │  │  InfluxDB → Grafana             │
│  Local dashboard    │  │  grafana.tkforgeworks.com       │
└─────────────────────┘  └────────────────────────────────┘
```

SQLite is the authoritative store. InfluxDB sync is best-effort and never blocks the local write path.

---

## 2. Collection Tier

### 2.1 Tier 1 — Live Log Watcher

**What it does:** Tails `main.log` continuously using Node.js `fs.watch` / `readline`. New lines are parsed on arrival and matched against known patterns. Matching events are deduplicated and written to SQLite.

**Runs as:** A background process within the Electron main process. Starts on app launch, runs continuously while the monitor app is open. For full coverage of Cowork sessions, the monitor should run as a system tray process.

**Log file path (MSIX install on Windows):**
```
C:\Users\<user>\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\logs\main.log
```

**Note:** This path is specific to the MSIX-packaged version of Claude Desktop. If the package identifier `Claude_pzs8sxrjxfjjc` changes between major versions, the path watcher must be updated. The app should verify the path exists on startup and surface a warning if it does not.

**Captured event patterns:**

| Event | Log Pattern | Fields |
|---|---|---|
| App launch | `Starting app {` | timestamp |
| App quit | `beforeQuit: handler fired` | timestamp |
| Clean shutdown | `onQuitCleanup: cowork-vm-shutdown` | timestamp |
| Cowork session created | `LocalAgentModeSessions.start:` | timestamp, sessionId (from next line) |
| Cowork title set | `updateSession: sessionId=X, options={"title":"..."}` | sessionId, title |
| Cowork turn started | `Lifecycle: ... initializing → running` | timestamp, sessionId |
| Cowork turn completed | `[Result] Turn succeeded for session X` | timestamp, sessionId |
| Cowork turn ended | `Lifecycle: ... running → idle` | timestamp, sessionId |
| CLI session mapped | `Mapping internal session X to CLI session Y` | internalId, cliId |
| Session count on boot | `Loaded N persisted sessions from ...` | timestamp, count |
| App focus | `[SkillsPlugin] Window focused — polling now (last poll was Xms ago)` | timestamp, gap_ms |

**Deduplication key:** `(event_type, session_id, timestamp)` — prevents double-insertion if the watcher restarts and re-reads recent lines.

**Log rotation handling:** Claude Desktop periodically rotates log files. The watcher must detect when the file is replaced (inode change or file size reset) and re-open the new file from the beginning.

---

### 2.2 Tier 2 — Claude Code JSONL Importer

**What it does:** On app startup and every 5 minutes, scans `~/.claude/projects/` recursively for JSONL files. Parses each file, extracts session-level records, deduplicates against SQLite using `session_id` as the unique key, and inserts new records.

**JSONL directory path:**
```
C:\Users\<user>\.claude\projects\
```

**JSONL file structure:** Each JSONL file represents one session. The filename is `{sessionId}.jsonl`. Subagent sessions are stored in `{sessionId}/subagents/agent-{agentId}.jsonl`. Each line is a JSON record discriminated by a `type` field.

**Record types:**

| `type` | Purpose | Token data? |
|---|---|---|
| `assistant` | Model response (text, thinking, tool_use) | Yes — `message.usage` |
| `user` | User message or tool result | No (but agent `toolUseResult.usage` on subagent returns) |
| `system` | Metadata — currently only `turn_duration` | No |
| `progress` | Subagent activity wrapper (contains inner assistant/user messages) | Yes — on inner `data.message.message.usage` |
| `file-history-snapshot` | File state tracking for undo | No |

**Token usage fields** (on `assistant` records at `message.usage`):

| Field | Type | Description |
|---|---|---|
| `input_tokens` | number | Non-cached input tokens |
| `output_tokens` | number | Output tokens generated |
| `cache_creation_input_tokens` | number | Tokens written to prompt cache |
| `cache_read_input_tokens` | number | Tokens read from prompt cache |

Multiple assistant records may share the same `requestId` (streaming chunks). The final chunk has `stop_reason` set and carries the authoritative usage totals for that API call.

**Other useful fields per record:**

| Field | Location | Description |
|---|---|---|
| `sessionId` | root | Session UUID (matches filename) |
| `message.model` | `assistant` records | Model ID, e.g. `claude-opus-4-6` |
| `timestamp` | root | ISO 8601 UTC |
| `cwd` | root | Working directory (= project path) |
| `slug` | root (after first turn) | Human-readable session name |
| `version` | root | Claude Code CLI version |

**Session-level aggregation:** The importer must scan all `assistant` records in a file, keeping only the final chunk per unique `requestId` (where `stop_reason` is set), then sum `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens` across those final chunks to produce session totals. The model is taken from the first assistant record (sessions use a single model). Session start is the earliest `timestamp`; session end is the latest.

**Subagent token handling:** Subagent JSONL files in `{sessionId}/subagents/` contain their own assistant records with independent usage. The importer must include subagent token usage in the parent session totals to avoid undercounting.

**Retention warning:** Claude Code deletes JSONL files older than 30 days by default. The app should check `~/.claude/settings.json` for `cleanupPeriodDays` on first run and display a persistent warning if it is set to 30 or less, with instructions to increase it.

---

### 2.3 Tier 3 — claude.ai Export Importer

**What it does:** Accepts a claude.ai data export ZIP file (requested manually from Settings > Privacy > Export data). Extracts and parses the JSON export, upserts conversation records into SQLite.

**Trigger:** User drag-and-drop or file picker in the Electron UI. Not automated — requires manual export request.

**Fields extracted:**
- Conversation UUID
- Title
- Message count
- Created at timestamp
- Updated at timestamp

**No message content is stored** — only metadata. This is a deliberate privacy boundary.

**Staleness prompt:** The app records the date of the last import and displays a notice when it is more than 14 days old, prompting the user to request a fresh export.

---

### 2.4 Cost Calculation

The JSONL files do not contain a cost field. The importer must compute `cost_usd` from token counts and model pricing.

**Formula per session:**

```
cost_usd = (input_tokens × input_rate)
         + (output_tokens × output_rate)
         + (cache_creation_input_tokens × cache_write_rate)
         + (cache_read_input_tokens × cache_read_rate)
```

All rates are per-token (divide the per-million-token price by 1,000,000).

**Pricing table (USD per million tokens, as of March 2026):**

| Model | Input | Output | Cache Write (5min) | Cache Read |
|---|---|---|---|---|
| `claude-opus-4-6` | $5.00 | $25.00 | $6.25 | $0.50 |
| `claude-sonnet-4-6` | $3.00 | $15.00 | $3.75 | $0.30 |
| `claude-haiku-4-5-20251001` | $1.00 | $5.00 | $1.25 | $0.10 |

**Cache write tier note:** The JSONL `message.usage.cache_creation` object distinguishes `ephemeral_5m_input_tokens` and `ephemeral_1h_input_tokens`. The 1-hour cache write rate is 2× input price (vs 1.25× for 5-minute). For accuracy, the importer should check both fields when present and apply the correct multiplier. If only the top-level `cache_creation_input_tokens` is available, the 5-minute rate is the safe default (Claude Code sessions are typically short-lived).

**Maintenance:** This pricing table is a configuration constant, not hardcoded in business logic. The table is stored as a JSON map keyed by model ID so that unrecognised models fall back to a warning rather than silently producing $0.00 costs.

**Cost recomputation:** The `cost_usd` column in `code_sessions` is a **materialized derivation**, not a permanent fact. It is computed at import time for query performance, but can be invalidated and refreshed when pricing changes. A `recalculateCosts()` function must be available that:

1. Reads the current pricing table
2. Iterates all rows in `code_sessions`
3. Recomputes `cost_usd` from the stored `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens`, and `model` columns
4. Updates each row in a single transaction

This function is exposed in the Settings panel as a "Recalculate costs" action, and is also triggered automatically when the pricing table is updated. This design means historical cost data is always correctable — a pricing table update retroactively fixes all past session costs rather than only affecting future imports.

---

## 3. Storage Tier — SQLite Schema

SQLite is the primary and authoritative store. All application data originates here. InfluxDB contains a derived copy only.

**Database path:** `%APPDATA%\ClaudeUsageMonitor\usage.db` (standard Electron userData path)

**WAL mode** must be enabled on database creation to prevent corruption on crash.

### Schema Migration System

The database uses a version-tracked migration system to handle schema changes across app updates. No ORM or external migration library is used — migrations are plain SQL strings executed sequentially by a lightweight runner in the main process.

**How it works:**

1. A `meta` table is created on first run:
   ```sql
   CREATE TABLE IF NOT EXISTS meta (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );
   INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '0');
   ```

2. Migrations are defined as an ordered array of `{ version: number, sql: string }` objects in the codebase (e.g. `src/main/db/migrations.ts`). Each migration's SQL may contain multiple statements separated by semicolons.

3. On startup, the runner reads the current `schema_version` from `meta`, then executes all migrations with a version greater than the current value, in order, inside a transaction. After each migration succeeds, `schema_version` is updated.

4. If a migration fails, the transaction is rolled back and the app surfaces an error. No partial migrations are persisted.

**Migration v1** (the initial schema) creates all six tables defined below. Every subsequent schema change — adding columns, creating indexes, altering defaults — is a new numbered migration. The v0.1 scaffold must include the migration runner and the v1 migration so that v0.2's first schema change is handled automatically.

---

### Table: `app_sessions`
One row per Claude Desktop application launch.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| launched_at | TEXT NOT NULL | ISO 8601 timestamp |
| quit_at | TEXT | Null if crash or still running |
| duration_seconds | INTEGER | Computed at quit |
| synced_to_influx | INTEGER DEFAULT 0 | 0 = pending, 1 = synced |

---

### Table: `cowork_sessions`
One row per Cowork session.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | TEXT UNIQUE NOT NULL | Internal session UUID from log |
| cli_session_id | TEXT | Mapped CLI session ID (may be null if not yet mapped) |
| title | TEXT | From `updateSession` log entry |
| started_at | TEXT NOT NULL | ISO 8601 |
| ended_at | TEXT | Null if session still active |
| turn_count | INTEGER DEFAULT 0 | Incremented on each `Turn succeeded` |
| synced_to_influx | INTEGER DEFAULT 0 | |

---

### Table: `cowork_turns`
One row per completed Cowork turn (a single send → response cycle).

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | TEXT NOT NULL | FK → cowork_sessions.session_id |
| started_at | TEXT NOT NULL | Timestamp of `initializing → running` |
| ended_at | TEXT NOT NULL | Timestamp of `running → idle` |
| duration_seconds | INTEGER | Computed |
| synced_to_influx | INTEGER DEFAULT 0 | |

---

### Table: `code_sessions`
One row per Claude Code session, sourced from JSONL files.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| session_id | TEXT UNIQUE NOT NULL | From JSONL |
| project_path | TEXT | Directory path |
| model | TEXT | e.g. `claude-opus-4-6` |
| input_tokens | INTEGER | Non-cached input tokens |
| output_tokens | INTEGER | |
| cache_creation_tokens | INTEGER | Tokens written to prompt cache |
| cache_read_tokens | INTEGER | Tokens read from prompt cache |
| cost_usd | REAL | Computed on import using token counts × model pricing (see §2.4) |
| started_at | TEXT | |
| ended_at | TEXT | |
| synced_to_influx | INTEGER DEFAULT 0 | |

---

### Table: `chat_conversations`
One row per Desktop chat conversation, sourced from claude.ai export.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| conversation_id | TEXT UNIQUE NOT NULL | UUID from claude.ai |
| title | TEXT | |
| message_count | INTEGER | |
| created_at | TEXT | |
| updated_at | TEXT | |
| imported_at | TEXT | When this row was upserted |

---

### Table: `app_focus_events`
One row per SkillsPlugin heartbeat, representing a window focus event.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PRIMARY KEY | Auto-increment |
| focused_at | TEXT NOT NULL | ISO 8601 |
| gap_since_last_ms | INTEGER | From log: `last poll was Xms ago` |

---

## 4. Remote Sync Tier — InfluxDB / Grafana

### Overview

After a successful SQLite write, the app asynchronously pushes the same data to InfluxDB as line protocol points. This is fire-and-forget — failures are logged, the `synced_to_influx` flag remains 0, and a background retry job re-sends pending rows on a 60-second interval when connectivity is available.

The Grafana/InfluxDB instance is the existing tkforgeworks homelab deployment.

### Homelab Target

| Property | Value |
|---|---|
| Grafana URL | grafana.tkforgeworks.com |
| InfluxDB datasource (Flux) | UID: `dexhh5uydjmyoc` |
| InfluxDB datasource (SQL) | UID: `fey9hhs5aercwe` |
| Suggested bucket | `claude-usage` |
| Suggested retention | 365 days |

### InfluxDB Measurements

| Measurement | Tags | Fields | Timestamp |
|---|---|---|---|
| `cowork_session` | `session_id`, `title` | `turn_count`, `duration_seconds` | `started_at` |
| `cowork_turn` | `session_id` | `duration_seconds` | `started_at` |
| `code_session` | `project_path`, `model` | `input_tokens`, `output_tokens`, `cache_creation_tokens`, `cache_read_tokens`, `cost_usd` | `started_at` |
| `app_session` | — | `duration_seconds` | `launched_at` |
| `chat_conversation` | — | `message_count` | `created_at` |

### Sync Implementation Notes

- Use `@influxdata/influxdb-client-js` — the official Node.js client, supports both Flux and InfluxQL query interfaces
- InfluxDB token must be encrypted at rest using Electron's `safeStorage` API (DPAPI on Windows), not stored in plaintext config files
- The retry job queries `SELECT * FROM <table> WHERE synced_to_influx = 0` across all tables and attempts to write in batches of 100 points
- On successful write, update `synced_to_influx = 1` for the affected rows
- The settings panel should display: last successful sync timestamp, count of pending unsynced rows per table, and a manual "Sync now" button

---

## 5. Presentation Tier — Electron GUI

### Process Architecture

```
Electron Main Process
├── Log Watcher (chokidar)
├── JSONL Importer (scheduled, every 5 min)
├── SQLite connection (better-sqlite3)
├── InfluxDB sync worker (scheduled, every 60 sec)
└── IPC API (typed channels) → Renderer

Electron Renderer Process
└── React app
    ├── Today view
    ├── Cowork sessions view
    ├── Claude Code sessions view
    ├── Chat history view
    ├── Usage heatmap
    └── Settings panel
```

### IPC Contract

The renderer communicates with the main process exclusively through named, typed IPC channels. The renderer never issues raw SQL or accesses SQLite directly. All query logic lives in the main process behind handler functions.

**Channel naming convention:** `{domain}:{action}` — e.g. `codeSessions:getAll`, `coworkSessions:getByDate`, `settings:get`.

**Channel categories:**

| Category | Example Channels | Direction |
|---|---|---|
| Query | `codeSessions:getAll`, `codeSessions:getByDateRange`, `coworkSessions:getSummaryToday` | renderer → main → renderer |
| Mutation | `settings:update`, `dashboard:save`, `chatImport:start` | renderer → main → renderer |
| Push | `logWatcher:newEvent`, `jsonlImporter:scanComplete`, `sync:statusChanged` | main → renderer |

**Type safety:** Channel request/response types are defined in a shared TypeScript module (e.g. `src/shared/ipc-types.ts`) imported by both the main process handlers and the renderer's preload script. This provides compile-time verification that the renderer sends the correct payload shape and receives the expected response type.

**Preload script:** The preload script exposes a `window.api` object via `contextBridge.exposeInMainWorld()`. Each method on `window.api` maps to one IPC channel. The renderer never calls `ipcRenderer.invoke()` directly — it calls typed methods on `window.api`.

```
// Conceptual shape of window.api (defined in preload)
window.api = {
  codeSessions: {
    getAll(range: DateRange): Promise<CodeSession[]>,
    getByProject(project: string, range: DateRange): Promise<CodeSession[]>,
  },
  coworkSessions: {
    getSummaryToday(): Promise<TodaySummary>,
    getAll(range: DateRange): Promise<CoworkSession[]>,
  },
  settings: {
    get(): Promise<AppSettings>,
    update(partial: Partial<AppSettings>): Promise<void>,
  },
  // Push events via callback registration
  onLogWatcherEvent(callback: (event: LogEvent) => void): void,
  onImportComplete(callback: (summary: ImportSummary) => void): void,
}
```

This contract is defined in v0.1 and extended as new views are added in subsequent phases. New channels are added alongside the features that need them.

### Technology Choices

| Component | Technology | Reason |
|---|---|---|
| Desktop framework | Electron | Specified; matches Claude Desktop's own stack |
| UI | React + TypeScript | Standard Electron UI approach |
| Charting | Recharts | Lightweight, React-native, no canvas deps |
| Local DB | better-sqlite3 | Synchronous SQLite, best for Electron main process |
| Log tailing | chokidar + readline | Cross-platform file watching with reliable rotation detection on Windows (fs.watch has known issues with file replacement on NTFS) |
| InfluxDB client | @influxdata/influxdb-client-js | Official client |
| Credential storage | Electron safeStorage | Built-in, DPAPI-backed, no native module needed (replaces deprecated keytar) |
| Packaging | electron-builder | Standard, supports Windows NSIS installer |

### Dashboard Views

**Today view** — sessions started today, total Cowork turns, total Claude Code cost today, estimated active time from focus events, quick-glance status indicators. Horizontal timeline bar showing session activity throughout the day.

**Weekly chart** — bar chart with one bar per day for the last 7 days, stacked by source (Cowork / Code / Chat import).

**Cowork sessions list** — sortable table: title, date, turn count, total session duration, avg turn duration. Expandable rows for turn-level detail. Turn duration histogram (buckets: <1m, 1-3m, 3-5m, 5-10m, 10m+).

**Claude Code sessions list** — sortable table: project path, model, input/output/cache tokens, estimated cost, date. Cost-by-project horizontal bar chart and model distribution donut chart.

**Trends view** — cache efficiency ratio per project, turn duration trend line, 7-day rolling cost velocity, session density, model migration stacked area chart, project activity Gantt timeline, and computed usage pattern stats (peak hour/day, streaks, averages).

**Chat history view** — conversation count over time (from export data), date of last import, import button.

**Usage heatmap** — GitHub-style calendar heatmap across all sources combined, showing relative activity intensity per day (intensity = distinct session count across all sources).

**Settings panel** — Dashboard layout configuration, remote connection profiles (InfluxDB), sync status, log file path override, export importer, database backup.

### Configuration Files

All user-facing configuration is stored as JSON in the Electron `userData` directory (`%APPDATA%\ClaudeUsageMonitor\`):

| File | Purpose |
|---|---|
| `settings.json` | App settings: remote connection profiles (with safeStorage-encrypted tokens), log path override, sync enable/disable, import history |
| `dashboard.json` | Dashboard layout: visible views/widgets, display order, per-widget defaults (time range, sort column). Editable via settings panel or directly as JSON |

No additional config formats (YAML, TOML, etc.) are introduced. JSON is consistent with the Electron/Node.js stack and requires no extra parsing dependencies.

---

## 6. Open Questions

| # | Question | Status | Resolution |
|---|---|---|---|
| OQ-1 | Should the monitor app run as a persistent system tray process, or only when the window is open? | **Resolved** | Persistent system tray process. Close-to-tray behaviour from Phase v0.1. Full-file backfill on startup (FR-1.10) covers gaps. |
| OQ-2 | Does the MSIX package identifier `Claude_pzs8sxrjxfjjc` change between Claude Desktop major versions? | **Mitigated** | Auto-discovery via glob `Claude_*` (FR-1.8) removes the hardcoded dependency. User-configurable fallback path in settings. |
| OQ-3 | Is the claude.ai export JSON schema documented or stable? | Open | Medium — the export importer may need updating on schema changes. Chat import is deferred to Phase v0.4. |
| OQ-4 | What InfluxDB retention policy should the `claude-usage` bucket use? | Open | Low — homelab storage planning. Suggested 365 days. |
| OQ-5 | Should Cowork active time be estimated from turn duration alone, or also factor in the gap between turns within a session? | Open | Low — affects accuracy of daily active time metric |

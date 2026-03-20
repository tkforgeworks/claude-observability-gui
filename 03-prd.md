# Claude Usage Monitor — Product Requirements Document

**Project:** Claude Usage Monitor
**Author:** Tim Klimpel / tkforgeworks
**Date:** March 2026
**Version:** 0.1 Draft

---

## 1. Product Vision

A lightweight Windows desktop application that gives a developer a clear, persistent view of how they use Claude across all surfaces — Cowork, Code, and Desktop chat — with data stored locally in SQLite and optionally synced to a self-hosted Grafana/InfluxDB instance in the tkforgeworks homelab.

The application does not require an Anthropic API key and does not transmit any data to Anthropic or third parties. All data remains on the user's machine or within their own homelab infrastructure.

---

## 2. Users & Use Cases

This is a single-user personal tool. The user is a solo developer using Claude Desktop (primarily Cowork and chat) and Claude Code on Windows 11, with a self-hosted Grafana instance available in their homelab.

| As a... | I want to... | So that... |
|---|---|---|
| Developer using Cowork | See how many sessions I started today and how long each turn took | I can understand my agentic usage patterns over time |
| Developer using Claude Code | See token consumption and estimated cost per project over time | I can monitor spend and optimise session length |
| Heavy Desktop chat user | Import my chat history and see conversation frequency over time | I have a baseline view of my chat-side usage even without real-time data |
| Homelab operator | See Claude usage data in my existing Grafana instance | I have a single pane of glass across my personal tooling and infrastructure |
| Developer (all surfaces) | See a daily and weekly activity heatmap | I can identify usage trends and peak times across the week |

---

## 3. Functional Requirements

### FR-1: Log Watcher

**FR-1.1** The app must tail `main.log` from the Claude Desktop MSIX data directory on startup and process new lines in real time.

**FR-1.2** The app must parse and store all Cowork session events: session creation, title assignment, turn start, turn completion, and turn end.

**FR-1.3** The app must parse and store app launch and quit events from `main.log`.

**FR-1.4** The app must parse SkillsPlugin window focus entries to approximate app active time at ~10-minute resolution.

**FR-1.5** The app must handle log file rotation gracefully — detecting when the file is replaced and re-opening the new file from the beginning.

**FR-1.6** All parsed events must be deduplicated before SQLite insert using `(event_type, session_id, timestamp)` as the composite key.

**FR-1.7** If the log file path cannot be found on startup (e.g. after a Claude Desktop update changes the MSIX package path), the app must display a persistent, actionable warning in the UI rather than silently failing.

---

### FR-2: Claude Code JSONL Importer

**FR-2.1** The app must scan `~/.claude/projects/` recursively for JSONL files on startup and every 5 minutes while running.

**FR-2.2** The app must parse JSONL records and extract session-level data: session ID, project path, model name, input/output/cache tokens, estimated cost, and timestamps.

**FR-2.3** The app must upsert records using `session_id` as the unique key so re-scans do not create duplicates.

**FR-2.4** On first run, the app must check `~/.claude/settings.json` for the `cleanupPeriodDays` value. If it is 30 or less (the default), the app must display a persistent notice with instructions to increase it to preserve history beyond the default 30-day window.

---

### FR-3: claude.ai Export Importer

**FR-3.1** The app must accept a claude.ai data export ZIP file via drag-and-drop onto the import panel or via a standard file picker dialog.

**FR-3.2** The app must extract and parse the export JSON, upserting conversation records (UUID, title, message count, timestamps) into SQLite using `conversation_id` as the unique key.

**FR-3.3** The app must display an import summary after each import: conversations found in export, newly inserted, and skipped as duplicates.

**FR-3.4** The app must record the timestamp of the last successful import and display a notice when it is more than 14 days old, prompting the user to request a fresh export from claude.ai Settings > Privacy.

**FR-3.5** The app must not store any message content from the export — only conversation-level metadata (ID, title, message count, timestamps).

---

### FR-4: Local SQLite Storage

**FR-4.1** The SQLite database must be created automatically at `%APPDATA%\ClaudeUsageMonitor\usage.db` on first run.

**FR-4.2** WAL (Write-Ahead Logging) mode must be enabled on database creation.

**FR-4.3** The app must run schema migrations automatically on version upgrade using a versioned migration system. No manual steps should be required from the user after an update.

**FR-4.4** The settings panel must expose a manual database backup function that copies `usage.db` to a user-selected location.

**FR-4.5** The database path must be displayed in the settings panel so the user can locate it independently.

---

### FR-5: InfluxDB Sync

**FR-5.1** After each successful SQLite write, the app must asynchronously attempt to push the same data as InfluxDB line protocol points to the configured homelab instance.

**FR-5.2** InfluxDB connection details (URL, bucket, org) must be configurable in the settings panel. The InfluxDB token must be stored in Windows Credential Manager via `keytar`, not in any plaintext file.

**FR-5.3** Sync failures must not block the UI or the local SQLite write path. A failed sync must be logged and the affected rows must remain with `synced_to_influx = 0`.

**FR-5.4** A background retry job must run every 60 seconds, querying for rows where `synced_to_influx = 0` and attempting to re-send them in batches of up to 100 points per table.

**FR-5.5** The settings panel must display: last successful sync timestamp, total count of pending unsynced rows across all tables, and a manual "Sync now" button.

**FR-5.6** Sync must be independently enable/disable-able in settings without losing pending data.

---

### FR-6: Dashboard UI

**FR-6.1 Today view** — The default landing screen must show: sessions started today (by type), total Cowork turns completed today, total estimated Claude Code cost today, and estimated active time derived from focus events.

**FR-6.2 Weekly activity chart** — A bar chart with one bar per day for the rolling 7-day window, with bars subdivided by source (Cowork sessions, Code sessions, Chat conversations from import).

**FR-6.3 Cowork sessions list** — A scrollable, sortable table showing: session title, date, turn count, and total session duration. Rows should be clickable to expand turn-level detail.

**FR-6.4 Claude Code sessions list** — A scrollable, sortable table showing: project path (shortened), model, input tokens, output tokens, cache tokens, estimated cost (USD), and date.

**FR-6.5 Chat history view** — A chart showing Desktop chat conversation count over time (week/month toggle), sourced from the most recent export import. The date of the last import and a prompt to re-import must be visible on this screen.

**FR-6.6 Usage heatmap** — A GitHub-style calendar heatmap showing relative activity intensity per day across all sources combined, covering the last 12 months (or available data range if shorter).

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | The log watcher must process new log lines within 500ms of them being written to disk |
| Performance | SQLite queries powering any dashboard view must complete in under 100ms |
| Performance | The Electron app must use less than 1% CPU at idle and less than 150MB of memory |
| Reliability | SQLite WAL mode must be used to prevent database corruption on unexpected process termination |
| Reliability | InfluxDB sync failure must never cause data loss in SQLite |
| Reliability | The JSONL importer must be idempotent — running it multiple times must not create duplicate records |
| Security | The InfluxDB token must be stored in Windows Credential Manager, never in a plaintext config file |
| Privacy | No conversation content is stored or transmitted — only metadata (IDs, titles, counts, timestamps) |
| Privacy | No data is sent to any service other than the user's own homelab InfluxDB instance |
| Compatibility | Must run on Windows 11 on the same machine as Claude Desktop (MSIX install) |
| Maintainability | The Claude Desktop log file path must be stored as a single configurable constant, overridable in settings, so path changes after Claude Desktop updates can be fixed without a code release |

---

## 5. Phased Delivery Plan

Scoped to individual weekend work sessions. Each phase is independently shippable.

### Phase v0.1 — Foundation
**Scope:** Electron app skeleton with system tray support, SQLite setup with full schema, Claude Code JSONL importer, basic Code sessions list view.

**Done when:** The app runs in the system tray, imports Claude Code JSONL data on startup, displays a sortable sessions list with token counts and costs, and persists data across restarts.

---

### Phase v0.2 — Live Cowork Tracking
**Scope:** Log watcher for `main.log`, Cowork session and turn event parsing, Today view with live updates.

**Done when:** Starting a Cowork session causes a new entry to appear in the app within 1 second. Turn start and end times are recorded. The Today view reflects current session activity.

---

### Phase v0.3 — Chat History
**Scope:** claude.ai export importer (drag-and-drop), conversation count chart, 12-month usage heatmap, app launch/quit event capture.

**Done when:** Dropping a claude.ai export ZIP into the app populates the chat history view with conversation counts by date. The heatmap shows combined activity across Code, Cowork, and Chat.

---

### Phase v0.4 — Homelab Sync
**Scope:** InfluxDB writer with retry queue, settings panel with credential management, Grafana dashboard template for the `claude-usage` bucket.

**Done when:** Data flows to `grafana.tkforgeworks.com` within 2 minutes of being written locally. A Grafana dashboard shows Cowork session count, Code token usage, and daily activity trends. The settings panel shows sync status and pending row counts.

---

### Phase v0.5 — Polish
**Scope:** System tray notifications (e.g. on rate limit events from web log), app focus active time view, database backup UI, packaging as a distributable Windows installer.

**Done when:** The app can be installed from a standalone `.exe` installer without requiring Node.js or developer tooling on the host machine.

---

## 6. Out of Scope (v0.1 through v0.5)

The following are explicitly out of scope for all phases covered by this document:

- Real-time token counting for Desktop chat (no local data source exists)
- Browser extension integration
- Multi-machine usage aggregation
- Mobile app usage tracking (iOS/Android Claude app)
- Any indexing or search over conversation message content
- Automated claude.ai export requests (no API support for Pro subscription)
- Usage comparison or benchmarking against other users
- Cost forecasting or budget alerts (may be considered in a future phase)

---

## 7. Assumptions & Dependencies

| Item | Assumption |
|---|---|
| Claude Desktop install | Installed via MSIX (Windows Store) — the virtualised data path is used |
| Log format stability | The `main.log` event patterns identified during research remain consistent across Claude Desktop updates |
| InfluxDB availability | The homelab InfluxDB instance at `grafana.tkforgeworks.com` is accessible from the development machine on the home network |
| claude.ai export format | The JSON export schema from Settings > Privacy is sufficiently stable for parsing |
| Node.js on host | Not required for end users — Electron bundles its own Node.js runtime |
| Claude Code install | Claude Code is installed and has generated JSONL data in `~/.claude/projects/` |

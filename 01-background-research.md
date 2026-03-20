# Claude Usage Monitor — Background Research

**Project:** Claude Usage Monitor
**Author:** Tim Klimpel / tkforgeworks
**Date:** March 2026
**Status:** Complete — findings confirmed via live log analysis

---

## Overview

This document captures the research and exploratory investigation conducted to determine what local data is accessible from the Claude Desktop application on Windows. The goal was to establish what usage signals are realistically available before committing to an application architecture.

Research was conducted by directly examining the Claude Desktop file system, live-tailing log files, and correlating known user actions against log output in real time.

---

## 1. Existing Projects & Prior Art

Before investigating local files, a survey of existing Claude usage monitoring tools was conducted.

### Claude Code — Well Covered

Two mature open-source CLI tools already address Claude Code monitoring:

**ccusage** (github.com/ryoppippi/ccusage) — parses `~/.claude/projects/*.jsonl` files directly. Provides daily, monthly, session, and 5-hour billing window reports. Supports JSON export via `--json` flag, model breakdown, cache token tracking, and MCP integration. Zero-install via `npx ccusage@latest`.

**Claude-Code-Usage-Monitor** (github.com/Maciek-roboblog) — a real-time terminal dashboard with burn rate analysis, session forecasting, P90-based limit detection, and cost projections. Runs alongside a coding session.

Both tools read the same JSONL source — `~/.claude/projects/` — which is the richest, most reliable local data available across all Claude surfaces.

### claude.ai Desktop Chat — Fragmented Browser Extensions

Several Chrome extensions attempt to track claude.ai usage with mixed results:

- **Claude Usage Extension** (github.com/lugia19/Claude-Usage-Extension) — estimates token consumption from conversation history using either the Anthropic API or a local tokenizer. User reviews flag inaccuracy and compatibility issues with newer Claude versions.
- **Claude Exporter** / **agoramachina** — exports conversations as JSON, Markdown, or plain text. Branch-aware, supports bulk export. Useful as a data source rather than a tracker.
- **Claude Counter** — tracks message counts and renders a usage graph. Simple but counts interactions only, no token data.

### Key Finding on API Access

There is no Anthropic API endpoint for personal Pro subscription usage. The Anthropic Console usage API only reflects API key (pay-as-you-go) consumption. Claude Desktop, claude.ai chat, and Cowork usage is not queryable via any official API for Pro subscribers.

The claude.ai Settings > Privacy page does support a manual data export (conversation history as JSON, delivered by email), but this is a one-time snapshot, not a live feed.

---

## 2. Claude Desktop File System Investigation

### Installation Path (MSIX on Windows)

Claude Desktop on Windows installs via MSIX, which activates filesystem virtualisation. The actual data directory is not at the expected `%APPDATA%\Claude\` but at a virtualised path:

```
C:\Users\<user>\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\
```

This distinction matters — the "Edit Config" button in Developer settings opens the standard path, but the app reads from the virtualised one. MCP configurations placed in the wrong location are silently ignored.

### Directory Structure

A full recursive file listing of the Claude data directory revealed the following structure of interest:

```
Claude\
├── logs\
│   ├── main.log                    (190 KB — primary app log)
│   ├── claude.ai-web.log           (90 KB — embedded webview log)
│   ├── cowork_vm_node.log          (15 KB — Cowork VM events)
│   ├── mcp.log                     (25 KB — MCP connection events)
│   └── mcp-server-<name>.log      (per-MCP-server error logs)
├── claude_desktop_config.json      (167 bytes — MCP server config)
├── config.json                     (1.7 KB — OAuth token cache, theme, extension state)
├── sentry\
│   ├── session.json                (265 bytes — session ID and start timestamp)
│   └── scope_v3.json               (18 KB — Sentry error reporting context)
├── local-agent-mode-sessions\      (Cowork session data and skill files)
├── vm_bundles\claudevm.bundle\     (10 GB — Linux VM used by Cowork/Code)
├── Network\Cookies                 (SQLite — auth cookies)
├── IndexedDB\                      (Chromium persistent app state)
└── Session Storage\                (LevelDB — transient session state)
```

### What Was Ruled Out Immediately

- `Cache\`, `GPUCache\`, `DawnCache\` — standard Chromium render caches, no useful data
- `vm_bundles\` — the Linux VM image for Cowork, binary/not parseable
- `DIPS`, `DIPS-wal` — Chromium domain/IP tracking, not relevant
- `config.json` — contains encrypted OAuth token and extension allowlist state only
- `sentry\session.json` — contains a session start timestamp and device ID, but only one entry (current session)

---

## 3. Log File Analysis

### 3.1 main.log

**Format:** Line-based, timestamped `YYYY-MM-DD HH:MM:SS [level] message`

**Retention:** Covers the current install, approximately 3–5 days before rolling.

**Content summary:** Infrastructure-focused. Covers app lifecycle, MCP server connections, extension/skill syncs, Claude Code binary downloads, OAuth token refreshes, and Cowork session management.

**Useful signals identified:**

| Log Pattern | Meaning |
|---|---|
| `Starting app {` | Application launched |
| `beforeQuit: handler fired` | Application quit initiated |
| `onQuitCleanup: cowork-vm-shutdown` | Clean shutdown completed |
| `LocalAgentModeSessions.start:` | Cowork session created |
| `updateSession: sessionId=X, options={"title":"..."}` | Cowork session title assigned |
| `Lifecycle: ... initializing → running` | Cowork turn started |
| `[Result] Turn succeeded for session X` | Cowork turn completed |
| `Lifecycle: ... running → idle` | Cowork turn ended (duration = end − start) |
| `Mapping internal session X to CLI session Y` | Internal and CLI session IDs linked |
| `Loaded N persisted sessions from ...` | Session count on app boot |
| `[SkillsPlugin] Window focused — polling now (last poll was Xms ago)` | App window regained focus; gap_ms is time since last focus |

**Not present in main.log:** Any chat messages, chat session IDs, MCP tool calls from chat-side, window minimize/restore events, or any Desktop chat activity signal.

### 3.2 claude.ai-web.log

**Format:** Same timestamp format as main.log. Mix of `[error]`, `[warn]`, `[info]` entries.

**Retention:** Same rolling window, approximately 3 days observed.

**Content summary:** Embedded Chromium webview log. Mostly CSP violation errors from blocked third-party scripts (Google Ads, Intercom, Stripe). Some React component warnings and MCP app timing events.

**Useful signals identified:**

| Log Pattern | Meaning | Reliability |
|---|---|---|
| `en=msg_sent` in blocked Google Ads URL | Message sent in Desktop chat | Low — fires only when ad tracker loads |
| `url=https%3A%2F%2Fclaude.ai%2Fchat%2F<uuid>` | Chat conversation UUID | Low — same caveat as above |
| `tiba=<url-encoded title>` | Conversation page title | Low — same caveat |
| `ProseMirror expects the CSS white-space...` | Chat editor initialised / focused | Low — fires once per app load |
| `[LOCAL_SESSION] unknown sdk message type: rate_limit_event` | Rate limit event during Cowork turn | Medium — Cowork-only |
| `[COMPLETION] Request failed` | API completion error | Medium |
| `en=form_start` / `en=form_submit` on `/task/new` | Cowork task creation in webview | Low — inconsistent |

**Critical finding:** The `msg_sent` events in the web log are a side effect of Google Tag Manager's conversion pixel being blocked by CSP — they are not a deliberate local hook. They fire inconsistently, do not cover all chat messages, and are absent entirely for native Desktop chat UI interactions that don't go through the embedded webview URL path.

### 3.3 Live Correlation Test

To validate findings, a live tail was run on both log files simultaneously while performing controlled actions. Results:

| Action Performed | Time | main.log | claude.ai-web.log |
|---|---|---|---|
| Minimize then restore app | 21:37 | No entry | No entry |
| Start new chat, send 2 messages | 21:38 | No entry | No entry |
| Switch between chat windows | 21:38 | No entry | No entry |
| Start Cowork session, send message | 21:39 | Full session lifecycle ✅ | rate_limit_event ✅ |
| MCP tool use (Atlassian/Jira) in chat | 21:40 | No entry | No entry |
| Switch to existing chat, send message | 21:41 | No entry | No entry |
| Close and reopen app | 21:45 | Full quit/launch sequence ✅ | CSP errors on reload ✅ |

**Conclusion:** Desktop chat produces zero local signal. Cowork produces a rich, structured local signal. App lifecycle events are fully captured.

---

## 4. Claude Code JSONL Data

Claude Code stores all session data as JSONL files in:

```
C:\Users\<user>\.claude\projects\
```

Each file contains per-turn records with: session ID, project path, model name, input tokens, output tokens, cache creation tokens, cache read tokens, estimated cost (USD), and timestamps.

This is the richest available data source. It is stable, structured, and well-understood — the ccusage tool confirms the schema is consistent across Claude Code versions.

**Important caveat:** Claude Code deletes JSONL files older than 30 days by default. This can be changed by setting `cleanupPeriodDays` in `~/.claude/settings.json`. Users should configure this before starting data collection to avoid losing history.

---

## 5. claude.ai Data Export

Anthropic supports a manual data export from Settings > Privacy > Export data. The export is delivered as a ZIP file to the registered email address. It contains conversation metadata and history as JSON.

This is the only mechanism for accessing Desktop chat history. It is not real-time and requires manual triggering. The download link expires after 24 hours. There is no API to automate the export for Pro subscription users.

---

## 6. Summary of Data Availability

| Data Point | Available | Source | Quality |
|---|---|---|---|
| Cowork session start/end times | Yes | main.log | High |
| Cowork session titles | Yes | main.log | High |
| Cowork turn duration | Yes | main.log | High |
| Cowork turn count per session | Yes | main.log | High |
| App launch / quit times | Yes | main.log | High |
| App focus events (~10 min resolution) | Yes | main.log | Medium |
| Claude Code token counts | Yes | JSONL files | High |
| Claude Code model and cost data | Yes | JSONL files | High |
| Desktop chat conversation list | Yes (manual) | claude.ai export | Medium |
| Desktop chat message counts | Yes (manual) | claude.ai export | Medium |
| Desktop chat messages in real time | No | — | None |
| Desktop chat token usage | No | — | None |
| MCP tool calls from chat | No | — | None |
| Anthropic API usage (Pro plan) | No | — | None |

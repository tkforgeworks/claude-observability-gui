# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Claude Usage Monitor — an Electron desktop app for tracking Claude AI usage across Claude Code and Claude Desktop. Built with Electron 41, React 18, TypeScript, and better-sqlite3.

## Commands

| Task | Command |
|------|---------|
| Dev mode (watch) | `npm run dev` |
| Build all | `npm run build` |
| Build main only | `npm run build:main` |
| Build renderer only | `npm run build:renderer` |
| Launch app | `npm start` |
| Type-check (no emit) | `npm run compile` |
| Run all tests | `npm test` |
| Run a single test | `npx jest --testPathPattern=costCalculator` |
| Package installer | `npm run dist` |
| Rebuild native modules | `npx electron-rebuild` |

After `npm install`, always run `npx electron-rebuild` to compile better-sqlite3 for the Electron version.

## Architecture

Three independent compilation targets share types but never import runtime code across boundaries:

```
src/main/        → Electron main process (CommonJS, tsc → dist/main/)
src/preload/     → Context bridge (exposes window.api via contextBridge)
src/renderer/    → React UI (ESNext, webpack → dist/renderer/)
src/shared/      → Type-only definitions (ipc-types.ts, models.ts)
```

### Main process (`src/main/`)

- **Entry:** `main.ts` — sets Windows AppUserModelID (must match `build.appId` in `package.json`), applies launch-on-startup preference, creates BrowserWindow with `assets/icon.ico`, initializes DB, registers IPC handlers, starts JSONL scan timer, LogWatcher, UsageLimitWatcher, tray refresh loop, and chat import staleness notification
- **Launch on startup:** `services/launchOnStartup.ts` — wraps `app.setLoginItemSettings`. Applied once on startup from `loadSettings().launchOnStartup`, re-applied inside the `settings:update` IPC handler whenever the flag is present in the patch
- **Database:** `db/database.ts` — better-sqlite3 with WAL mode. Schema migrations in `db/migrations/` (versioned, cumulative, never modify existing ones). Queries in `db/queries.ts`
- **Date bucketing convention (CGUI-52):** all date-grouped analytics bucket by **local** calendar day — SQL uses `DATE(col, 'localtime')` and JS day keys use the exported `localDateStr()` helper in `queries.ts`. Never use bare `DATE(col)` or `toISOString().slice(0, 10)` for day grouping/scaffolds (UTC bucketing shifts evening sessions to the next day). Rolling windows (e.g. the 24h Today cutoff) are exempt — they're duration-based, not calendar-based. Regression tests in `__tests__/timezoneBucketing.test.ts` pin `TZ=America/New_York` because CI runs UTC where the bug is invisible
- **JSONL Importer:** `importers/jsonlImporter.ts` — scans `~/.claude/projects/` on startup and every 5 minutes, parses session files, calculates costs via `importers/costCalculator.ts`, upserts to SQLite
- **Chat Importer:** `importers/chatImporter.ts` — parses claude.ai export ZIPs (`conversations.json`, `projects.json`, `users.json`) into `chat_conversations` and related tables
- **LogWatcher:** `services/logWatcher.ts` — tails Claude Desktop `main.log`, parses lines via `services/logLineParser.ts`, persists events to `cowork_sessions`, `cowork_turns`, `app_sessions`, and `app_focus_events`. Uses a persisted offset/timestamp to skip already-processed lines on restart
- **UsageLimitWatcher:** `services/usageLimitWatcher.ts` — polls `~/.claude/projects/*/cship/*-usage-limits` files on a configurable interval (default 60s — must stay at or below the ~60s file TTL or polls will always find expired files), reads the most recently modified file, parses `five_hour_pct`/`seven_day_pct` subscription usage data, persists to `usage_snapshots` table, and prunes old data per retention setting. Files carry an `expires_at` (epoch seconds, ~60s TTL after each cship refresh); expired files are skipped entirely — stale data means "unknown", never "0%". cship only refreshes these files while a Claude Code session is active, so snapshots are captured only when a poll lands within the TTL window; the Usage view shows a staleness notice when the latest snapshot is >15 min old
- **Data Export/Import:** `services/dataExportImport.ts` (CGUI-49) — "Moving to a new computer?" section in Settings → General. Export bundles a consistent DB snapshot (native `.backup()`), portable settings, and dashboard.json into a zip with a schema-version manifest. Import merges a bundle insert-only (never overwrites/deletes): `INSERT OR IGNORE` on tables with unique keys, NULL-safe composite-key `NOT EXISTS` dedup on the rest (`usage_snapshots` on captured_at, `app_sessions` on launched_at, `cowork_turns` on session_id+started_at, `app_focus_events` on focused_at). Supports repeated bidirectional desktop↔laptop merging. Settings travel via the `PORTABLE_SETTINGS_KEYS` allowlist only — machine paths, connection profiles, and local bookkeeping never enter the bundle. Older-schema bundles are migrated before merge; newer-schema bundles are rejected. IPC: `data:exportAll` / `data:importAll`. Tests in `__tests__/dataExportImport.test.ts` — the DB-backed suite auto-skips locally after `electron-rebuild` (Electron ABI) and runs in CI; run locally via `ELECTRON_RUN_AS_NODE=1 npx electron node_modules/jest/bin/jest.js --testPathPatterns=dataExportImport`
- **IPC Handlers:** `ipc/handlers.ts` — all channels typed via `ElectronApi` interface in `shared/ipc-types.ts`
- **Config:** `config/configStore.ts` (settings + dashboard load/save), `config/pricing.ts` (per-model token rates), `config/defaultSettings.ts` — JSON files in `%APPDATA%\ClaudeUsageMonitor\`

### Preload (`src/preload/`)

Single file that exposes `window.api` via `contextBridge.exposeInMainWorld`. Every IPC channel must be registered here to be accessible from the renderer.

### Renderer (`src/renderer/`)

- **Views:** `views/` — page-level components:
  - `TodayView` — 24-hour summary with metric cards and session timeline
  - `CoworkSessionsView` — sortable Cowork session table with turn expansion
  - `CodeSessionsView` — Code session table with date range filter, cost/model charts
  - `TrendsView` — 7 analytics widgets with shared time range selector (7d/30d/90d/1y):
    1. Usage Patterns — 8-stat card grid + 24-hour distribution heatbar
    2. Cost Velocity — headline 7d avg daily cost, daily bar chart + 7d MA line
    3. Cache Efficiency — reuse ratio bars by project, expandable token breakdown table
    4. Turn Duration Trend — daily avg line chart + 7-day moving average
    5. Session Density — sessions per active hour line chart
    6. Project Activity Timeline — Gantt-style swimlane grid, expandable project list
    7. Model Migration — stacked area chart with auto-discovered model series
  - `UsageView` — subscription usage limit tracking with stat cards (5-hour and 7-day usage percentages with reset countdowns), sparklines, and a Usage History table with range selector (24h/7d/30d/90d/All): one row per collected snapshot (capture timestamp, 5h/7d percentages, upcoming reset times) interleaved with dimmed "window reset (inferred)" rows. Reset markers are derived in the renderer from stored `resets_at` values on every load (restarts backfill resets that passed while closed), never shown for future times, and deduped by proximity (same window type within 60 min = polling jitter, since real resets are ≥5h/7d apart). Subscribes to `onUsageSnapshot` for live updates
  - `HeatmapView` — 365-day GitHub-style usage heatmap
  - `ChatHistoryView` — claude.ai export import + stats: conversation counts (weekly/monthly), projects table, memories, conversation/project heatmaps. Staleness banner drives on-import threshold from `settings.chatStalenessDays`
  - `SettingsView` — tabbed config (General, Remote Sync, Dashboard, Data). Data tab includes live database stats (size, oldest records per table) and one-click backup via better-sqlite3's native `.backup()` API. Supports deep-linking to a specific tab via `navigate('/settings', { state: { tab: 'general' } })` — reads `location.state.tab` and syncs to `activeTab` on mount and on subsequent location changes
- **Components:** `components/common/` (chart widgets, MetricCard, EmptyState, StatusBanner, GlobalBanners), `components/layout/` (Sidebar, ContentArea). `GlobalBanners` is rendered inside `ContentArea` (above `<Routes>` in `App.tsx`) and shows persistent warnings for LogWatcher connection loss (non-dismissible, with Retry + Go to General Tab / Open Settings actions) and log-format health issues (dismissible, re-arms on next unhealthy trigger). `StatusBanner` supports an `actions` array for multiple buttons, or a single `action` for backwards compatibility.
- **Hooks:** `hooks/useApi.ts` — generic async fetching hook with loading/error state
- **Styling:** Dark theme with inline CSS (background: `#1a1a2e`, text: `#ccccdd`, accent: `#6666cc`). Charts use Recharts library.

### IPC contract

Channel naming: `{domain}:{action}` (e.g., `codeSessions:getAll`, `analytics:getCacheEfficiency`). The `ElectronApi` interface in `shared/ipc-types.ts` is the single source of truth — main process handlers, preload bridge, and renderer consumers all reference it. Adding a new IPC channel requires changes in all three layers (types → query → handler → preload → renderer).

Push events flow main → renderer via `webContents.send()` with corresponding `onXxx` subscription methods in ElectronApi.

### Cost calculation

`src/main/importers/costCalculator.ts` applies per-model pricing from `src/main/config/pricing.ts`. Formula: `(inputTokens/1M * inputRate) + (outputTokens/1M * outputRate) + (cacheRead/1M * cacheReadRate) + (cacheWrite/1M * cacheWriteRate)`. The pricing table covers Opus 4.6, Sonnet 4.6, and Haiku 4.5 with both 5-min and 1-hour cache write rates.

## Testing

Jest + ts-jest, test environment: node. Tests live in `src/main/__tests__/`. Config: `jest.config.js` uses `tsconfig.test.json`.

## Data storage

App data lives in a `ClaudeUsageMonitor` subdirectory of Electron's userData path (dev: `%APPDATA%\claude-usage-monitor\ClaudeUsageMonitor\`; packaged: `%APPDATA%\<productName>\ClaudeUsageMonitor\`):
- `settings.json` — user preferences
- `dashboard.json` — view/widget configuration
- `usage.db` — SQLite database (+ WAL files)

## Packaging

`electron-builder` NSIS target for Windows x64, configured in `package.json` under `build`:
- **Per-user install** (`perMachine: false`) — no UAC prompt, installs to `%LOCALAPPDATA%\Programs\claude-usage-monitor`
- **Shortcuts:** desktop + start menu, labeled "Claude Usage Monitor"
- **Settings preservation on upgrade:** `settings.json`, `dashboard.json`, and `usage.db` live in `%APPDATA%` (Electron userData) and are untouched by NSIS install/upgrade. `deleteAppDataOnUninstall: false` is explicit so uninstalling also leaves user data in place
- **Icon:** `assets/icon.ico` (256×256) — currently a pink/black checkerboard placeholder until final icon lands
- **Launch on startup:** user-toggleable in Settings → General. Wired via `app.setLoginItemSettings` in `src/main/services/launchOnStartup.ts`, applied on app start (reads `settings.launchOnStartup`) and re-applied inside the `settings:update` IPC handler whenever the flag is included in the patch. Default is `false`
- **Taskbar icon:** `app.setAppUserModelId('com.tkforgeworks.claude-usage-monitor')` is called at module load in `main.ts` (Windows-only guard) so the Windows taskbar groups the process under the app identity rather than `electron.exe`. **Must match `build.appId` in `package.json`** — if either is changed, update both
- **Tray icon:** `src/main/tray.ts` loads `assets/icon.ico` via `nativeImage.createFromPath` and downscales it to 16×16 with `quality: 'best'` for the system tray slot

## CI / Releases

- **`.github/workflows/ci.yml`** — runs on push to `main` and on PRs. Ubuntu runner. Steps: `npm ci` → `npm run compile` → `npm test`. No installer build
- **`.github/workflows/release.yml`** — runs on tags matching `v*`. Two jobs: `release-notes` (ubuntu) generates the release body via `scripts/generate-release-notes.js`, then `build-windows` (required for NSIS) runs `npm ci` → `npx electron-rebuild` → `npm run dist` → creates the release as a **draft** with `release/*.exe` attached, then publishes via `gh release edit` (immutable releases lock assets at publish time — never publish before uploading). Tags containing a hyphen (e.g. `v1.0.0-rc.1`) are auto-flagged as pre-releases. Uses the default `GITHUB_TOKEN` via `permissions: contents: write`
- **Release notes** (TK ForgeWorks standard): the `release-notes` job consumes the reusable workflow `tkforgeworks/.github/.github/workflows/release-notes.yml@main` (`ticket-prefix: CGUI`) — the canonical script lives in the org standards repo, not here. Body derives from commit subjects since the previous tag: version-bump commits filtered, subjects split into Changes vs Bug Fixes (bug-fix commit subjects must start with `Fix` or `CGUI-N: Fix ...`), `CGUI-*` keys auto-linked via the `JIRA_BASE_URL` repo variable. Stable releases diff against the previous *stable* tag so final notes span all RCs. Write commit subjects knowing they become changelog lines
- **Release cadence:** `npm version patch|minor|major` bumps `package.json` and creates the matching `v*` tag atomically. `git push --follow-tags` triggers the release workflow
- **Builds are unsigned.** Windows SmartScreen will warn users until a code-signing certificate is added. Bypass: *More info → Run anyway*. README Installation section documents this for testers

## Analytics IPC channels

The Trends view uses these `analytics:*` channels, each following the full vertical slice pattern:

| Channel | Query function | Returns |
|---------|---------------|---------|
| `analytics:getWeeklyActivity` | `queryWeeklyActivity` | 7-day code/cowork session counts |
| `analytics:getHeatmapData` | `queryHeatmapData` | Daily token breakdowns for heatmap |
| `analytics:getCacheEfficiency` | `queryCacheEfficiency` | Per-project cache reuse ratios and savings |
| `analytics:getTurnDurationTrend` | `queryTurnDurationTrend` | Daily avg Cowork turn duration |
| `analytics:getDailyCosts` | `queryDailyCosts` | Daily cost totals (+ 7 extra days for comparison) |
| `analytics:getSessionDensity` | `querySessionDensity` | Sessions per active hour per day |
| `analytics:getModelMix` | `queryModelMix` | Daily session counts by model |
| `analytics:getProjectTimeline` | `queryProjectTimeline` | Per-project active dates for Gantt view |
| `analytics:getUsagePatterns` | `queryUsagePatterns` | Hourly/daily distribution, streaks, averages |

## Chat IPC channels

The Chat History view uses these `chat:*` channels, backed by the claude.ai ZIP importer:

| Channel | Returns |
|---------|---------|
| `chat:getConversationCounts` | Conversation counts grouped by week or month |
| `chat:getStats` | Aggregate chat stats (totals, date range) |
| `chat:getProjects` | Project list with per-project conversation counts |
| `chat:getMemories` | Memory entries extracted from export |
| `chat:getConversationHeatmap` | Daily conversation counts for heatmap |
| `chat:getProjectHeatmap` | Daily project-activity counts for heatmap |

## Usage Snapshots IPC channels

The Usage view uses these `usageSnapshots:*` channels:

| Channel | Query function | Returns |
|---------|---------------|---------|
| `usageSnapshots:getLatest` | `queryLatestUsageSnapshot` | Most recent usage snapshot or null |
| `usageSnapshots:getRecent` | `queryUsageSnapshots` | Snapshots within last N hours |
| `usageSnapshots:getRange` | `queryUsageSnapshotRange` | Snapshots in a date range |

## Push events (main → renderer)

Subscribed via `window.api.onXxx(callback)`, which returns an unsubscribe function:

- `onLogWatcherEvent` / `onLogWatcherHealth` — live LogWatcher events and health status
- `onLogWatcherConnection` — LogWatcher connection state (log path found/lost); paired with `logWatcher.retry()` request channel which re-runs path discovery and restarts the watcher
- `onScanStarted` / `onImportComplete` — JSONL importer scan lifecycle
- `onSyncStatusChanged` — remote sync state (stub)
- `onUsageSnapshot` — new usage limit snapshot captured by UsageLimitWatcher
- `onNavigate` — main-process navigation commands (used by the stale-chat Notification click handler to deep-link to `/chat`)

## Jira

Project key: **CGUI**. Tracked in Jira Cloud.

## Project Rules

**IMPORTANT — follow these rules exactly:**

1. **Always update CLAUDE.md as the last step of any ticket closure.** When wrapping up work on a ticket, review this file and update any sections that are now stale (new views, new IPC channels, new services, changed architecture, etc.). This keeps future sessions accurately grounded.

2. **Never close a Jira ticket unless specifically requested by the user.** Do not transition tickets to Done, Closed, or any terminal state on your own. The workflow is: move tickets to "In Progress", add detailed "Actions taken" + "Commit" comments, and leave them there. The user closes tickets manually after testing a fresh build.

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

- **Entry:** `main.ts` — sets Windows AppUserModelID (must match `build.appId` in `package.json`), appends `-dev` to userData when not packaged (CGUI-64), acquires the single-instance lock (CGUI-63 — a second same-variant launch quits immediately and the `second-instance` event restores/focuses the existing window, including from tray-hidden; the lock is per-userData-path so dev and installed builds still run side by side), applies launch-on-startup preference, creates BrowserWindow with `assets/icon.ico`, initializes DB, registers IPC handlers, starts JSONL scan timer, LogWatcher, UsageLimitWatcher, tray refresh loop, and chat import staleness notification
- **Launch on startup:** `services/launchOnStartup.ts` — wraps `app.setLoginItemSettings`. Applied once on startup from `loadSettings().launchOnStartup`, re-applied inside the `settings:update` IPC handler whenever the flag is present in the patch
- **Database:** `db/database.ts` — better-sqlite3 with WAL mode. Schema migrations in `db/migrations/` (versioned, cumulative, never modify existing ones). Queries in `db/queries.ts`
- **Date bucketing convention (CGUI-52):** all date-grouped analytics bucket by **local** calendar day — SQL uses `DATE(col, 'localtime')` and JS day keys use the exported `localDateStr()` helper in `queries.ts`. Never use bare `DATE(col)` or `toISOString().slice(0, 10)` for day grouping/scaffolds (UTC bucketing shifts evening sessions to the next day). Rolling windows (e.g. the 24h Today cutoff) are exempt — they're duration-based, not calendar-based. Regression tests in `__tests__/timezoneBucketing.test.ts` rely on `TZ=America/New_York`, pinned in `jest.config.js` (never inside a test file — jest copies `process.env` per test file, so in-test TZ assignments silently do nothing) because CI runs UTC where the bug is invisible
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
  - `UsageView` — subscription usage limit tracking with stat cards (5-hour and 7-day usage percentages with reset countdowns, plus a "Peak usage in window" sub-line showing the range's highest value via StatCard's optional `subMeta` prop), sparklines, and a Usage History table with range selector (24h/7d/30d/90d/All): one row per collected snapshot (capture timestamp, 5h/7d percentages, upcoming reset times) interleaved with dimmed "window reset (inferred)" rows. Reset markers are derived in the renderer from stored `resets_at` values on every load (restarts backfill resets that passed while closed), never shown for future times, and deduped by proximity (same window type within 60 min = polling jitter, since real resets are ≥5h/7d apart). Subscribes to `onUsageSnapshot` for live updates
  - `HeatmapView` — 365-day GitHub-style usage heatmap
  - `ChatHistoryView` — claude.ai export import + stats: conversation counts (weekly/monthly), projects table, memories, conversation/project heatmaps. Staleness banner drives on-import threshold from `settings.chatStalenessDays`
  - `SettingsView` — tabbed config (General, Remote Sync, Dashboard, Data). General includes launch-on-startup and the CGUI-62 "Window" toggle for `minimizeToTrayOnClose` (the `close` handler reads the setting at close time, so it applies without restart; unchecked = closing the window quits the app). Data tab includes live database stats (size, oldest records per table) and one-click backup via better-sqlite3's native `.backup()` API. Supports deep-linking to a specific tab via `navigate('/settings', { state: { tab: 'general' } })` — reads `location.state.tab` and syncs to `activeTab` on mount and on subsequent location changes. CGUI-70: switching away from Dashboard with an unsaved draft is held behind an inline Save/Discard/Cancel prompt (only a dirty flag and two actions cross the component boundary — the draft stays owned by `DashboardTab`); the usage poll interval offers 30s/60s options because cship's files expire after ~60s and expired files are skipped, so longer intervals miss most collection windows; retention is edited as raw text and clamped to 1–365 on blur; the Data tab reads journal mode from `PRAGMA journal_mode` and lists whatever tables `queryTableCounts` returns (discovered from `sqlite_master`, not a hardcoded list)
- **Components:** `components/common/` (chart widgets, MetricCard, EmptyState, StatusBanner, GlobalBanners, plus the CGUI-47 additions: `Loading` and `ErrorState` for the standard loading/error/empty triad, `SortableTh` for keyboard-accessible sortable table headers, `chartTheme.ts` for shared Recharts styling), `components/layout/` (Sidebar, ContentArea). `GlobalBanners` is rendered inside `ContentArea` **above the page scroll container** (CGUI-70 — inside it, the deliberately non-dismissible LogWatcher banner scrolled out of view); it owns its own padding since it sits outside `.page` and shows persistent warnings for LogWatcher connection loss (non-dismissible, with Retry + Go to General Tab / Open Settings actions) and log-format health issues (dismissible, re-arms on next unhealthy trigger). `StatusBanner` supports an `actions` array for multiple buttons, or a single `action` for backwards compatibility.
- **Hooks:** `hooks/useApi.ts` — generic async fetching hook with loading/error/refetch state. **Convention (CGUI-66):** every view fetch goes through it, renders `Loading`/`ErrorState`/`EmptyState` as three distinct states, and never maps an error to an empty state; settings mutations catch, revert on failure, and surface an inline error. **Extended (CGUI-70):** range-filtered views must distinguish an empty *range* from an empty *database* — probe for data outside the range (only when the range came back empty) and say how many records are out there, rather than repeating the first-run copy. Keep surrounding chrome (banners, scan status, stat cards) rendered around the empty state instead of early-returning past it
- **Styling:** Dark theme, tokens in `styles/app.css` `:root` (background `#0f172a`, text `--text-primary` `#e2e8f0`, accent `--purple-primary` `#a855f7`, chart series `--chart-1..6`) + inline styles referencing them. Charts use Recharts with shared axis/tooltip/cursor styling from `components/common/chartTheme.ts` (CGUI-67) — new chart widgets should import it rather than restating colors.
- **Formatters (CGUI-70):** `utils/format.ts` is the single home for display formatting — `formatCost`, `formatTokens`, `formatBytes`, `formatDuration`, `formatElapsed`, `formatDateTime`/`formatDateFull`/`formatTime`, the `formatDayLabel*` family, `formatHour`, `shortenModel`, `formatProjectName`, `localDateStr`, `RANGE_DAYS`/`rangeDays`/`ALL_RANGE_DAYS`, `dateTickInterval`, `CHART_Y_AXIS_WIDTH`. Never redefine one locally; if a call site needs different output, add an option (as `formatDuration`'s `style` and `formatHour`'s do) rather than a copy. Before this there were 47 definitions across 25 files and `formatCost(0)` returned `"$0"`, `"—"` and `"$0.0000"` depending on the file.
  - **Null vs zero:** `null`/`undefined` means "no data" and renders as an em dash (`DASH`); a real `0` renders as a real zero. Callers must pass `null` for missing values rather than coercing to `0` — e.g. ProjectsView passes `null` for token counts when a project has no Code sessions, since `0` there means "not applicable".
  - **Day keys:** `YYYY-MM-DD` chart keys parse at local **noon**, not midnight — correct in every zone while avoiding the ones where local midnight doesn't exist on a DST transition day. `localDateStr()` is the renderer-side counterpart to the identically named helper in `db/queries.ts`; the two are duplicated deliberately because the compilation targets never share runtime code (CGUI-52).
  - **Typography:** monospace is for paths, counts and ids. Prose, status messages and UI action labels use Poppins.
- **Responsive convention (CGUI-69):** the window enforces `minWidth: 900` and is frameless, so the narrowest content column is **~656px** (900 − 180 sidebar − 56 `.page` padding − 8 scrollbar); at the 1280 default it is ~1036px. Every view must render without horizontal overflow or clipped text between those bounds. Rules for new layout:
  - Multi-column grids use `repeat(auto-fit, minmax(min(<track>px, 100%), 1fr))`. The `min(…, 100%)` guard is the important half — a bare `minmax(<px>, 1fr)` whose minimum exceeds the container overflows instead of shrinking, which is what broke the chat heatmaps. A fixed `repeat(N, 1fr)` is fine for small N whose content survives the squeeze (`.stats-grid`'s default `repeat(4, 1fr)` yields ~153px tracks at 900px and holds because `.stat .value` is a `cqw` clamp), but not for 5+ tracks: `repeat(6, 1fr)` gave ~100px cards on Projects. 158px is the track minimum that yields 6-up at 1280 and 3×2 at 900
  - Uneven splits (e.g. 1.5fr/1fr) use the `.chart-row` > `.chart-row-grid` pair, which collapses to a stack below an 820px **container** width. Prefer `@container` over viewport media queries — the content column is not the viewport, and container queries match the `container-type: inline-size` convention CGUI-59 established on `.stat`
  - Fixed-width SVG/grid charts (heatmaps, Gantt) get an `overflow-x: auto` wrapper around the drawing only — never on the element a `ResizeObserver` measures, or the scrollbar feeds back into the computed cell size
  - Grid/flex children that hold charts or long labels need `min-width: 0`; text columns that can't shrink need `text-overflow: ellipsis` plus a `title`
  - Content inside a full-span `<td>` must be width-budgeted (the cell sizes to content and widens the whole table — an `overflow-x` wrapper alone won't hold it)
  - Verified with a Playwright `_electron` sweep over every view × range at 900×600 and 1280×800, asserting `.page` has no horizontal scroll. Note `.page` is the scroller: its `overflow-x` computes to `auto` as a side effect of `overflow-y: auto`, so a scan that excuses every `overflow-x: auto` element will miss page-level overflow

### IPC contract

Channel naming: `{domain}:{action}` (e.g., `codeSessions:getAll`, `analytics:getCacheEfficiency`). The `ElectronApi` interface in `shared/ipc-types.ts` is the single source of truth — main process handlers, preload bridge, and renderer consumers all reference it. Adding a new IPC channel requires changes in all three layers (types → query → handler → preload → renderer).

Push events flow main → renderer via `webContents.send()` with corresponding `onXxx` subscription methods in ElectronApi.

### Cost calculation

`src/main/importers/costCalculator.ts` applies per-model pricing from `src/main/config/pricing.ts`. Formula: `(inputTokens/1M * inputRate) + (outputTokens/1M * outputRate) + (cacheRead/1M * cacheReadRate) + (cacheWrite/1M * cacheWriteRate)`. The pricing table covers Fable 5, Opus 5, Opus 4.8/4.7/4.6, Sonnet 5 (introductory $2/$10 rates — bump to $3/$15 after 2026-08-31, see comment in pricing.ts), Sonnet 4.6, and Haiku 4.5, each with both 5-min and 1-hour cache write rates. When a new model releases, add its entry to `PRICING_TABLE` and extend `__tests__/pricing.test.ts`; unknown models fall back to a warning rather than $0.00 costs.

## Testing

Jest + ts-jest, test environment: node. Tests live in `src/main/__tests__/`. Config: `jest.config.js` uses `tsconfig.test.json`.

## Data storage

App data lives in a `ClaudeUsageMonitor` subdirectory of Electron's userData path. `package.json` has no top-level `productName` (the electron-builder `build.productName` is not read by Electron's runtime), so userData derives from `name` in both modes; `main.ts` appends `-dev` when not packaged (CGUI-64) so dev never touches installed-app data:
- Dev (`npm start`): `%APPDATA%\claude-usage-monitor-dev\ClaudeUsageMonitor\`
- Packaged/installed: `%APPDATA%\claude-usage-monitor\ClaudeUsageMonitor\`

Files:
- `settings.json` — user preferences
- `dashboard.json` — view/widget configuration
- `usage.db` — SQLite database (+ WAL files)

A fresh dev environment starts with an empty DB. Code sessions repopulate automatically on the first JSONL scan; Cowork/LogWatcher history, usage snapshots, chat imports, and settings do not — seed them via Settings → General → data export/import (CGUI-49) or a one-time copy of the `ClaudeUsageMonitor` subfolder from the prod path.

## Packaging

`electron-builder` NSIS target for Windows x64, configured in `package.json` under `build`:
- **Per-user install** (`perMachine: false`) — no UAC prompt, installs to `%LOCALAPPDATA%\Programs\claude-usage-monitor`
- **Shortcuts:** desktop + start menu, labeled "Claude Usage Monitor"
- **Settings preservation on upgrade:** `settings.json`, `dashboard.json`, and `usage.db` live in `%APPDATA%` (Electron userData) and are untouched by NSIS install/upgrade. `deleteAppDataOnUninstall: false` is explicit so uninstalling also leaves user data in place
- **Icon:** wireframe-gear mark with purple→indigo gradient (CGUI-57 interim, replaced again at the 2.0 COG rebrand). `assets/icon.ico` is multi-resolution (16/24/32/48/64/128/256 — the 16/24 layers use heavier strokes for legibility); `assets/icon.svg` is the vector source and `assets/icon.png` a 512px master (org standard, ready for Linux targets in CGUI-61). The sidebar mark is the same geometry inlined as `GearMark` in `Sidebar.tsx` — keep the three in sync if the icon changes
- **Launch on startup:** user-toggleable in Settings → General. Wired via `app.setLoginItemSettings` in `src/main/services/launchOnStartup.ts`, applied on app start (reads `settings.launchOnStartup`) and re-applied inside the `settings:update` IPC handler whenever the flag is included in the patch. Default is `false`
- **Taskbar icon:** `app.setAppUserModelId(...)` is called at module load in `main.ts` (Windows-only guard) so the Windows taskbar groups the process under the app identity rather than `electron.exe`. Packaged uses `com.tkforgeworks.claude-usage-monitor` — **must match `build.appId` in `package.json`**; if either is changed, update both. Dev uses a `.dev` suffix (CGUI-64): with the shared AUMID, Windows matched dev windows to the installed app's Start Menu shortcut, grouped them onto its taskbar button, and showed the shortcut's old icon instead of the window icon
- **Tray icon:** `src/main/tray.ts` loads `assets/icon.ico` via `nativeImage.createFromPath` and downscales it to 16×16 with `quality: 'best'` for the system tray slot

## CI / Releases

- **Branching (anvil pattern):** `main` is protected (repo ruleset — PRs only, required `typecheck-and-test` check, no force-push/deletion, no bypass). Each release gets a branch `vX.Y.Z/main` cut from `main`; topic branches are named `vX.Y.Z/<topic>` and PR into it; the release branch PRs into `main` when the version ships
- **`.github/workflows/ci.yml`** — runs on pushes and PRs for `main` and `v*/main`. Ubuntu runner. Steps: `npm ci` → `npm run compile` → `npm test`. No installer build
- **`.github/workflows/release.yml` (tagless pipeline, CGUI-65)** — triggers on pushes to `main` and `v*/main`, **never on tags** (no one pushes tags; CI creates them). `check-release` reads the `package.json` version and skips unless tag `v{version}` is missing AND the branch/version combination is legal: RC versions (`-rc.`/`alpha`/`beta`) release only from `v*/main` (as prereleases), stable versions only from `main`. The stable-version bump that `release:final` pushes to the release branch therefore does NOT release — the release cuts when its PR merges to `main`. Remaining jobs: `release-notes`, `typecheck-and-test` (release gate — mirrors CI), and `build-windows` (`npm ci` → `npx electron-rebuild` → `npm run dist` → **draft** release with `release/*.exe` and `tag_name: v{version}` at `target_commitish: github.sha`, then published via API — immutable releases lock assets at publish time; publishing is what creates the tag). Workflow-level `concurrency: group: release` queues overlapping merges
- **Release notes** (TK ForgeWorks standard): the `release-notes` job consumes the reusable workflow `tkforgeworks/.github/.github/workflows/release-notes.yml@main` (`ticket-prefix: CGUI`, `release-version: v{version}` passed explicitly since the workflow runs pre-tag) — the canonical script lives in the org standards repo, not here. Body derives from commit subjects since the previous tag: version-bump and merge commits filtered, subjects split into Changes vs Bug Fixes (bug-fix commit subjects must start with `Fix` or `CGUI-N: Fix ...`), `CGUI-*` keys auto-linked via the `JIRA_BASE_URL` repo variable. Stable releases diff against the previous *stable* tag so final notes span all RCs. Write commit subjects knowing they become changelog lines
- **Release cadence:** on the release branch, `npm run rc:patch|minor|major` bumps to the next `-rc.N` (commit + push, no tag, refuses to run on `main`) and the push cuts a GitHub prerelease. `npm run release:final` promotes the RC to its stable version and opens the PR into `main`; merging it cuts the stable release. `npm run release:patch|minor|major` is the direct no-RC path (creates a `release/vX.Y.Z` branch + PR when run from `main`). Never run `npm version` + `git push --tags` manually — direct pushes to `main` are rejected by the ruleset and tags are CI-created
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

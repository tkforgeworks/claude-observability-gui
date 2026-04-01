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

- **Entry:** `main.ts` — creates BrowserWindow, initializes DB, registers IPC handlers, starts JSONL scan timer
- **Database:** `db/database.ts` — better-sqlite3 with WAL mode. Schema migrations in `db/migrations/` (versioned, cumulative, never modify existing ones). Queries in `db/queries.ts`
- **JSONL Importer:** `importers/jsonlImporter.ts` — scans `~/.claude/projects/` on startup and every 5 minutes, parses session files, calculates costs via `importers/costCalculator.ts`, upserts to SQLite
- **IPC Handlers:** `ipc/handlers.ts` — all channels typed via `ElectronApi` interface in `shared/ipc-types.ts`
- **Config:** `config/configStore.ts` (settings + dashboard load/save), `config/pricing.ts` (per-model token rates) — JSON files in `%APPDATA%\ClaudeUsageMonitor\`
- **Services:** `services/` — LogWatcher and InfluxDB sync (stubs for v0.2+)

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
  - `HeatmapView` — 365-day GitHub-style usage heatmap
  - `ChatHistoryView` — stub for chat export importer
  - `SettingsView` — app configuration, database stats, import controls
- **Components:** `components/common/` (chart widgets, MetricCard, EmptyState, StatusBanner), `components/layout/` (Sidebar, ContentArea)
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

App data lives in `%APPDATA%\ClaudeUsageMonitor\`:
- `settings.json` — user preferences
- `dashboard.json` — view/widget configuration
- `usage.db` — SQLite database (+ WAL files)

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

## Jira

Project key: **CGUI**. Tracked in Jira Cloud.

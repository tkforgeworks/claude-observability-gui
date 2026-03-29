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
- **Config:** `config/settings.ts` and `config/dashboardConfig.ts` — JSON files in `%APPDATA%\ClaudeUsageMonitor\`
- **Services:** `services/` — LogWatcher and InfluxDB sync (stubs for v0.2+)

### Preload (`src/preload/`)

Single file that exposes `window.api` via `contextBridge.exposeInMainWorld`. Every IPC channel must be registered here to be accessible from the renderer.

### Renderer (`src/renderer/`)

- **Views:** `views/` — page-level components (TodayView, CodeSessionsView, SettingsView, etc.)
- **Components:** `components/common/` (MetricCard, EmptyState, StatusBanner), `components/layout/` (Sidebar, ContentArea)
- **Hooks:** `hooks/useApi.ts` — generic async fetching hook
- **Styling:** Dark theme with inline CSS (background: `#1a1a2e`, text: `#ccccdd`, accent: `#6666cc`)

### IPC contract

Channel naming: `{domain}:{action}` (e.g., `code-sessions:get-all`). The `ElectronApi` interface in `shared/ipc-types.ts` is the single source of truth — main process handlers, preload bridge, and renderer consumers all reference it. Adding a new IPC channel requires changes in all three layers.

Push events flow main → renderer via `webContents.send()` with corresponding `onXxx` subscription methods in ElectronApi.

### Cost calculation

`src/main/importers/costCalculator.ts` applies per-model pricing from `src/main/config/pricingTable.ts`. Formula: `(inputTokens/1M * inputRate) + (outputTokens/1M * outputRate) + (cacheRead/1M * cacheReadRate) + (cacheWrite/1M * cacheWriteRate)`.

## Testing

Jest + ts-jest, test environment: node. Tests live in `src/main/__tests__/`. Config: `jest.config.js` uses `tsconfig.test.json`.

## Data storage

App data lives in `%APPDATA%\ClaudeUsageMonitor\`:
- `settings.json` — user preferences
- `dashboard.json` — view/widget configuration
- `usage.db` — SQLite database (+ WAL files)

## Jira

Project key: **CGUI**. Tracked in Jira Cloud.

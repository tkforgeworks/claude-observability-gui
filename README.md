# Claude Usage Monitor

An Electron desktop application for tracking and visualizing Claude AI usage across Desktop, Claude Code, and Cowork sessions.

## Current Status

**Phase: Scaffolding complete, pre-implementation.**

The app builds and launches with a working navigation shell but no live data yet.

### What works

- Electron app launches with a dark-themed sidebar + content area layout
- SQLite database is created at `%APPDATA%/claude-usage-monitor/ClaudeUsageMonitor/usage.db`
- Schema migrations run automatically on startup (v1 schema with all tables)
- IPC handlers are registered and wired between renderer and main process
- Navigation across 7 views: Today, Cowork Sessions, Code Sessions, Chat History, Trends, Heatmap, Settings
- Minimize-to-tray on window close (restore via tray icon or File > Exit to quit)

### What's stubbed / not yet implemented

- **Data importers** — JSONL importer and log watcher are scaffolded but not started
- **Views** — All 7 views render placeholder content; no real data queries yet
- **Settings** — Returns hardcoded defaults, no persistence
- **Dashboard config** — Returns defaults, no save/load
- **Chat import** — Handler throws "not yet implemented"
- **InfluxDB sync** — Scaffolded but not started
- **Cost calculation** — Query function exists but no data to calculate against

### Database tables (all empty)

| Table | Purpose |
|---|---|
| `app_sessions` | Claude Desktop app launches |
| `cowork_sessions` | Cowork session tracking |
| `cowork_turns` | Individual turns within Cowork sessions |
| `code_sessions` | Claude Code sessions from JSONL files |
| `chat_conversations` | Desktop chat history from claude.ai export |
| `app_focus_events` | Window focus heartbeats |

## Development

### Prerequisites

- Node.js 20+
- Visual Studio Build Tools (for native module compilation on Windows)

### Setup

```bash
npm install
npx electron-rebuild
```

### Scripts

| Command | Description |
|---|---|
| `npm run build` | Build main + renderer |
| `npm run build:main` | Compile main process TypeScript |
| `npm run build:renderer` | Bundle renderer with webpack |
| `npm run dev` | Run main and renderer in watch mode |
| `npm start` | Launch the built Electron app |
| `npm run compile` | Type-check only (no emit) |
| `npm run dist` | Package for distribution via electron-builder |

### Project Structure

```
src/
  main/           # Electron main process
    config/       # Default settings, dashboard, pricing
    db/           # SQLite database, migrations, queries
    importers/    # JSONL importer, cost calculator (stubbed)
    ipc/          # IPC handler registration
    services/     # InfluxDB sync, log watcher (stubbed)
    main.ts       # App entry point
    tray.ts       # System tray setup
  preload/        # Context bridge (preload.ts)
  renderer/       # React UI
    components/   # Shared UI components
    views/        # Route-level view components
    hooks/        # Custom React hooks
  shared/         # Types shared between main and renderer
```

## Tech Stack

- **Runtime:** Electron 41
- **Language:** TypeScript
- **UI:** React 18, React Router, Recharts
- **Database:** better-sqlite3 (WAL mode)
- **Bundling:** webpack (renderer), tsc (main process)
- **Packaging:** electron-builder

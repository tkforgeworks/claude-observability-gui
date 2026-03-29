# Claude Usage Monitor

A desktop application for tracking and analyzing Claude AI usage across Claude Code and Claude Desktop (Cowork). Built with Electron, React, and SQLite.

## Current Status

**v0.1.0 — Foundation** is complete. The app provides a working local dashboard for monitoring Claude Code session data with automatic JSONL import, cost tracking, and a dark-themed UI.

### What works

- **Today Dashboard** — Rolling 24-hour summary with four metric cards (Sessions, Cowork Turns, Code Cost, Active Time). Three display states: no data, partial data (code only), and full data. Auto-refreshes on JSONL scan completion.
- **Claude Code Sessions** — Sortable table of all sessions parsed from `~/.claude/projects/` JSONL files. Columns: Project, Model, Input/Output/Cache Write/Cache Read tokens, Cost, Date. Summary bar with aggregate totals. Date range filter (7d / 30d / 90d / All). Cleanup warning banner when `cleanupPeriodDays` is 30 or fewer. Live scan status indicator.
- **JSONL Importer** — Scans `~/.claude/projects/` on startup and every 5 minutes, parsing session JSONL files into SQLite. Emits scan events to the renderer for real-time UI updates.
- **Cost Engine** — Per-session cost calculation using a tiered pricing table covering all Claude models (Opus, Sonnet, Haiku across 3.x, 4.x families) with separate cache write/read pricing. Unit tested.
- **Settings Panel** — Tabbed layout (General, Remote Sync, Dashboard, Data). Config file path display with one-click folder access. Database clear (dev tool).
- **Application Shell** — Dark-themed UI with fixed sidebar navigation. System tray with minimize-to-tray on close. Seven navigation views.
- **SQLite with WAL mode** — Local data store with automatic schema migrations on startup.
- **IPC Contract** — Fully typed channels between renderer, preload, and main process via contextBridge.

### Placeholder views (future versions)

| View | Target Version | Purpose |
|------|---------------|---------|
| Cowork Sessions | v0.2 | Claude Desktop session tracking via log watcher |
| Chat History | v0.3 | Conversation import and browsing |
| Trends | v0.3 | Usage analytics and charts |
| Heatmap | v0.3 | Activity visualization |

### Database tables

| Table | Status | Purpose |
|-------|--------|---------|
| `code_sessions` | Active | Claude Code sessions from JSONL files |
| `cowork_sessions` | Schema ready | Cowork session tracking |
| `cowork_turns` | Schema ready | Individual turns within Cowork sessions |
| `app_sessions` | Schema ready | Claude Desktop app launches |
| `chat_conversations` | Schema ready | Desktop chat history from claude.ai export |
| `app_focus_events` | Schema ready | Window focus heartbeats |

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
|---------|-------------|
| `npm run build` | Build main + renderer |
| `npm run build:main` | Compile main process TypeScript |
| `npm run build:renderer` | Bundle renderer with webpack |
| `npm run dev` | Run main and renderer in watch mode |
| `npm start` | Launch the built Electron app |
| `npm run compile` | Type-check only (no emit) |
| `npm test` | Run unit tests (Jest + ts-jest) |
| `npm run dist` | Package for distribution via electron-builder |

### Project Structure

```
src/
  main/              # Electron main process
    config/          # Settings, dashboard config, pricing table
    db/              # SQLite database, migrations, queries
    importers/       # JSONL parser and cost calculator
    ipc/             # IPC handler registration
    services/        # Log watcher, InfluxDB sync (stubs)
    tray.ts          # System tray
    main.ts          # Entry point
  preload/           # contextBridge API exposure
  renderer/          # React UI
    components/      # Shared components (MetricCard, EmptyState, etc.)
    views/           # Page-level views
    App.tsx          # Router and layout shell
  shared/            # Types shared across all processes
    ipc-types.ts     # IPC channel types, ElectronApi interface
```

## Tech Stack

- **Runtime:** Electron 41
- **Language:** TypeScript
- **UI:** React 18, React Router, Recharts
- **Database:** better-sqlite3 (WAL mode)
- **Bundling:** webpack (renderer), tsc (main process)
- **Packaging:** electron-builder (NSIS installer for Windows)
- **Testing:** Jest + ts-jest

## Roadmap

| Version | Epic | Focus |
|---------|------|-------|
| **v0.1.0** | Foundation | JSONL import, Code sessions table, Today dashboard, cost engine |
| v0.2.0 | Live Cowork Tracking | Claude Desktop log watcher, cowork session/turn tracking |
| v0.3.0 | Analytics | Trends charts, heatmap, chat history import |
| v0.4.0 | Remote Sync | InfluxDB push, multi-device aggregation |

## License

MIT

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

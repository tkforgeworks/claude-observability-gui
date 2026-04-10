# Claude Usage Monitor

A desktop application for tracking and analyzing Claude AI usage across Claude Code and Claude Desktop (Cowork). Built with Electron, React, and SQLite.

## Current Status

**v0.4.0 — Chat Import** is complete. The app is an actively-used local dashboard covering Claude Code, Claude Desktop (Cowork), and claude.ai chat history — with automatic JSONL import, live log tailing, cost tracking, analytics, and a dark-themed UI. Currently working through **v0.5.0 — Polish & Packaging**.

### What works

- **Today Dashboard** — Rolling 24-hour summary with metric cards (Sessions, Cowork Turns, Code Cost, Active Time) and session timeline. Three display states: no data, partial data (code only), and full data. Auto-refreshes on JSONL scan and LogWatcher events.
- **Claude Code Sessions** — Sortable table of all sessions parsed from `~/.claude/projects/` JSONL files. Columns: Project, Model, Input/Output/Cache Write/Cache Read tokens, Cost, Date. Summary bar with aggregate totals. Date range filter (7d / 30d / 90d / All). Cleanup warning banner when `cleanupPeriodDays` is 30 or fewer. Live scan status indicator.
- **Cowork Sessions** — Claude Desktop session tracking via LogWatcher tailing `main.log`. Sortable session table with expandable turn rows, plus a today-summary card. Sessions and turns are deduped on restart via a persisted offset.
- **Chat History** — claude.ai export ZIP importer with conversation-count charts (weekly/monthly), projects table, memories view, and conversation/project heatmaps. Stale-import banner + tray notification when data is older than `chatStalenessDays`.
- **Trends** — Seven analytics widgets (Usage Patterns, Cost Velocity, Cache Efficiency, Turn Duration, Session Density, Project Activity Timeline, Model Migration) with a shared time-range selector (7d/30d/90d/1y).
- **Heatmap** — 365-day GitHub-style activity visualization.
- **JSONL Importer** — Scans `~/.claude/projects/` on startup and every 5 minutes, parsing session JSONL files into SQLite. Emits scan events to the renderer for real-time UI updates.
- **LogWatcher** — Tails Claude Desktop `main.log` for Cowork sessions, turns, app launches, and window focus heartbeats. Persists its read offset so it skips already-processed lines on restart.
- **Cost Engine** — Per-session cost calculation using a tiered pricing table covering Claude models (Opus/Sonnet/Haiku across 3.x and 4.x families) with separate cache write/read pricing. Unit tested.
- **Settings Panel** — Tabbed layout (General, Notifications, Dashboard, Data). Drag-to-reorder dashboard views and default landing selection. Data tab shows live database size, oldest record per table, and one-click SQLite backup. Config file paths with one-click folder access.
- **Application Shell** — Dark-themed UI with fixed sidebar navigation. System tray with live session count + today's cost, minimize-to-tray on close, and deep-link navigation from notifications.
- **SQLite with WAL mode** — Local data store with automatic schema migrations on startup. Backup API handles WAL checkpointing automatically.
- **IPC Contract** — Fully typed channels between renderer, preload, and main process via contextBridge.

### Database tables

| Table | Status | Purpose |
|-------|--------|---------|
| `code_sessions` | Active | Claude Code sessions from JSONL files |
| `cowork_sessions` | Active | Cowork session tracking from LogWatcher |
| `cowork_turns` | Active | Individual turns within Cowork sessions |
| `app_sessions` | Active | Claude Desktop app launches |
| `app_focus_events` | Active | Window focus heartbeats from `main.log` |
| `chat_conversations` | Active | Desktop chat history from claude.ai export |
| `chat_projects` | Active | Chat projects from claude.ai export |
| `chat_memories` | Active | Memory entries from claude.ai export |

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
    importers/       # JSONL importer, chat ZIP importer, cost calculator
    ipc/             # IPC handler registration
    services/        # LogWatcher, log line parser, log path discovery
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

| Version | Epic | Status |
|---------|------|--------|
| v0.1.0 | Foundation — JSONL import, Code sessions table, Today dashboard, cost engine | Complete |
| v0.2.0 | Live Cowork Tracking — Claude Desktop log watcher, cowork session/turn tracking | Complete |
| v0.3.0 | Trends & Analytics — 7 analytics widgets, heatmap, dashboard config | Complete |
| v0.4.0 | Chat Import — claude.ai ZIP importer, Chat History view | Complete |
| **v0.5.0** | **Polish & Packaging — Tray notifications, DB backup, status banners, UI polish, installer** | **In Progress** |

## License

MIT

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

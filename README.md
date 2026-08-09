# Claude Usage Monitor

A free, local-first desktop app that tracks your Claude AI usage across **Claude Code**, **Claude Desktop (Cowork)**, and **claude.ai chat exports**. All data stays on your machine in a local SQLite database — nothing is sent anywhere.

Built with Electron, React, TypeScript, and better-sqlite3.

> **Windows only for now.** Pre-built installers are available for 64-bit Windows. See [Platform Support](#platform-support) for details.

## Why this exists

Claude doesn't give you a single place to see how much you're spending, which projects eat the most tokens, or how your usage patterns look over time. This app fills that gap by pulling data from the sources Claude already writes to disk and turning it into dashboards you can actually use.

## Quick start

**Windows**

1. Download the latest `.exe` from the [Releases page](../../releases).
2. Run the installer. Windows SmartScreen will warn you because the binary is unsigned — click **More info → Run anyway** (see [Known Limitations](#known-limitations)).
3. The app installs per-user (no admin needed) and starts importing data automatically.

**Linux**

1. Download the `.deb` (Debian/Ubuntu/Pop!_OS) or `.AppImage` (any distro) from the [Releases page](../../releases).
2. Install with `sudo apt install ./claude-usage-monitor-<version>.deb`, or make the AppImage executable and run it directly. The deb upgrades in place when you install a newer version.
3. Tray features need a StatusNotifier/AppIndicator host (GNOME needs the AppIndicator extension; Pop!_OS ships one).
4. Launch from your desktop's app grid (or `gtk-launch claude-usage-monitor`). Running the binary directly in a terminal keeps it attached to that terminal — useful for watching logs, but closing the terminal kills the app.

That's it. Claude Code session data is picked up from `~/.claude/projects/` within a few minutes. Cowork tracking (Windows only) starts as soon as Claude Desktop's `main.log` is found. Chat history requires a one-time manual import (see below).

## Features

### Today Dashboard

A rolling 24-hour summary showing session counts, cowork turns, code cost, and active time. Includes a session timeline visualizing when you were active throughout the day. Auto-refreshes as new data arrives.

### Claude Code Sessions

Every Claude Code session parsed from the JSONL files in `~/.claude/projects/`. The view includes:
- Sortable table with project, model, token breakdown (input/output/cache write/cache read), cost, and timestamp
- Aggregate stat cards and summary bar
- Cost-by-project horizontal bar chart and model distribution donut chart
- Date range filter (7d / 30d / 90d / All)
- A warning banner if your `cleanupPeriodDays` setting is 30 days or fewer (meaning old JSONL files are being deleted)

Data is scanned on startup and every 5 minutes. You'll see a live scan indicator in the view when an import is running.

### Cowork Sessions (Claude Desktop)

Tracks interactive pair-programming sessions in Claude Desktop by tailing the `main.log` file. Shows:
- Session table with turn counts and average turn duration
- Expandable turn-level detail per session
- Persisted read offset so restarts don't re-process old log lines

The sidebar shows a live "watcher live" / "watcher offline" indicator. If the log path can't be found, a banner appears with a retry button and a link to configure the path manually in Settings.

### Projects

Aggregates metrics across both Claude Code and Cowork sessions, grouped by project path. Shows:
- Per-project total cost, token breakdown, code/cowork session counts, active days, and model usage
- Sortable table with click-to-expand detail panels
- Summary stat cards with cross-project totals
- Time range filter (7d / 30d / 90d / 1y / All)

Projects are matched by filesystem path (case-insensitive on Windows), so Code and Cowork sessions for the same project directory are rolled up together automatically.

### Chat History (claude.ai Export)

Import your claude.ai conversation history from a data export ZIP. Once imported, the view shows:
- Conversation count charts (weekly or monthly)
- Projects table with per-project conversation counts and lifespan
- Memories extracted from the export
- Conversation and project activity heatmaps
- Staleness banner when your imported data is older than a configurable threshold

To import: go to [claude.ai](https://claude.ai) → Settings → Account → Export Data. Download the ZIP, then use the import button in the Chat History view.

### Trends

Seven analytics widgets with a shared time-range selector (7d / 30d / 90d / 1y):

| Widget | What it shows |
|--------|--------------|
| **Usage Patterns** | 8-stat summary card grid + 24-hour activity heatbar |
| **Cost Velocity** | Daily cost bar chart with 7-day moving average line |
| **Cache Efficiency** | Per-project cache reuse ratios with expandable token breakdown |
| **Turn Duration** | Daily average Cowork turn duration with trend line |
| **Session Density** | Sessions per active hour, showing how packed your working sessions are |
| **Project Activity Timeline** | Gantt-style swimlane showing when each project was active |
| **Model Migration** | Stacked area chart tracking which models you use over time |

### Heatmap

A GitHub-style activity heatmap showing your Claude usage intensity over time. Three layers:
- Cowork session count
- Input + output tokens
- Cache read + write tokens

Supports 3-month, 6-month, and 12-month views. Cells scale to fill the available width at any time range.

### Settings

Tabbed configuration panel:
- **General** — Log file path override, Claude Code data path override, launch on startup (on Linux this creates an XDG autostart entry that starts the app in the tray), minimize to tray, tray notifications
- **Dashboard** — Drag-to-reorder sidebar views, toggle visibility, set default landing view, show/hide individual Trends widgets
- **Data** — Live database stats (size, oldest records per table), one-click SQLite backup, open data folder

### System Tray

The app runs in the system tray with a context menu showing live session count and today's cost. On Windows, closing the window minimizes to tray by default; on Linux, closing quits the app unless you enable the tray option in Settings — and if no usable tray exists, closing always quits so the app can never get stranded in the background. With launch-on-startup enabled on Linux, sign-in launches start hidden in the tray (open the window from the tray menu). Tray notifications fire for stale chat imports.

## Data sources

| Source | How it's collected | Automatic? |
|--------|-------------------|------------|
| **Claude Code** | Parses JSONL session files from `~/.claude/projects/` | Yes — scans on startup + every 5 min |
| **Claude Desktop (Cowork)** | Tails `main.log` from Claude Desktop's app data directory (Windows only) | Yes — starts on app launch on Windows |
| **claude.ai chat history** | Imports from a manually downloaded data export ZIP | No — one-time manual import per export |

All data is stored locally in a SQLite database (`%APPDATA%\claude-usage-monitor\ClaudeUsageMonitor\usage.db` on Windows, `~/.config/claude-usage-monitor/ClaudeUsageMonitor/usage.db` on Linux). Nothing leaves your machine.

## Platform support

The release pipeline produces an NSIS installer for 64-bit Windows and AppImage + deb packages for 64-bit Linux.

Everything works identically on both platforms except Cowork tracking, which depends on Claude Desktop and is therefore Windows-only — on Linux the app says so in Settings instead of showing a connection error. Data lives in the platform's standard app-data location (`%APPDATA%` on Windows, `~/.config` on Linux) and can move between machines/platforms with Settings → General → data export/import.

macOS builds are not currently produced. If you want one, open an issue and let me know — the codebase is expected to build from source there (see [Development](#development)).

## Known limitations

- **Unsigned installer.** The Windows build is not code-signed, so SmartScreen will show a warning on first install. Click *More info → Run anyway*. This will be addressed when a signing certificate is added.
- **Cowork tracking requires Claude Desktop (Windows only).** The LogWatcher tails Claude Desktop's `main.log`, and Claude Desktop has no Linux build — on Linux the app marks the integration "Not Supported" in Settings rather than watching for a log that can't exist. If you don't use Claude Desktop, the Cowork-related views will be empty. Claude Code sessions are tracked independently on every platform.
- **Chat import is manual.** There's no API to pull claude.ai history automatically. You need to request a data export from claude.ai, download the ZIP, and import it each time you want updated chat data.
- **No remote sync.** The Remote Sync feature (push data to InfluxDB) is stubbed but not yet implemented. All data is local only.
- **Cost accuracy depends on the pricing table.** The built-in pricing covers current Claude models (Opus 4.6/4.7, Sonnet 4.6, Haiku 4.5). If Anthropic changes pricing or you use a model not in the table, costs may be inaccurate. A cost recalculation button is available in Settings if the pricing table is updated in a new release.
- **Claude Desktop log format changes.** The LogWatcher parses specific patterns from `main.log`. If Anthropic changes the log format, Cowork tracking may break until a parser update is released. The app shows a health warning banner if it detects parsing issues.
- **JSONL cleanup period.** Claude Code can be configured to delete old session files. If `cleanupPeriodDays` is set low, historical data is lost before the app can import it. A banner warns you if this is set to 30 days or fewer.

## Feedback and issues

This is in active development and I'm looking for feedback. If you find a bug, have a feature request, or something doesn't work the way you'd expect, please [open an issue](../../issues). Screenshots and reproduction steps are always appreciated.

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
| `npm run dev` | Run main and renderer in watch mode |
| `npm run build` | Build main + renderer |
| `npm start` | Launch the built Electron app |
| `npm run compile` | Type-check only (no emit) |
| `npm test` | Run unit tests (Jest + ts-jest) |
| `npm run dist` | Package for distribution via electron-builder |

### Project structure

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
    components/      # Shared components (charts, cards, layout)
    views/           # Page-level views
    App.tsx          # Router and layout shell
  shared/            # Types shared across all processes
    ipc-types.ts     # IPC channel types, ElectronApi interface
```

## Tech stack

- **Runtime:** Electron 41
- **Language:** TypeScript
- **UI:** React 18, React Router, Recharts
- **Database:** better-sqlite3 (WAL mode)
- **Bundling:** webpack (renderer), tsc (main process)
- **Packaging:** electron-builder (NSIS installer for Windows)
- **Testing:** Jest + ts-jest

## Releases

Tagged releases are built and published automatically via GitHub Actions. The installer appears under [Releases](../../releases) once the build finishes (~5-10 min).

Tags containing a hyphen (e.g. `v1.0.0-rc.1`) are automatically flagged as pre-releases.

## License

MIT

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

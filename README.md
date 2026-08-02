# Claude Usage Monitor

A free, local-first desktop app that tracks your Claude AI usage across **Claude Code**, **Claude Desktop (Cowork)**, and **claude.ai chat exports**. All data stays on your machine in a local SQLite database — nothing is sent anywhere.

Built with Electron, React, TypeScript, and better-sqlite3.

> **Windows only for now.** Pre-built installers are available for 64-bit Windows. See [Platform Support](#platform-support) for details.

## Why this exists

Claude doesn't give you a single place to see how much you're spending, which projects eat the most tokens, or how your usage patterns look over time. This app fills that gap by pulling data from the sources Claude already writes to disk and turning it into dashboards you can actually use.

## Quick start

1. Download the latest `.exe` from the [Releases page](../../releases).
2. Run the installer. Windows SmartScreen will warn you because the binary is unsigned — click **More info → Run anyway** (see [Known Limitations](#known-limitations)).
3. The app installs per-user (no admin needed) and starts importing data automatically.

That's it. Claude Code session data is picked up from `~/.claude/projects/` within a few minutes. Cowork tracking starts as soon as Claude Desktop's `main.log` is found. Chat history requires a one-time manual import (see below).

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

### Usage Limits

Tracks how much of your subscription capacity you've consumed, read from the usage-limit files Claude Code writes while a session is running:
- 5-hour and 7-day usage percentages with countdowns to the next reset
- Sparklines and a peak-usage figure per window
- A history table of every captured snapshot, interleaved with inferred window-reset markers
- A staleness notice when the newest snapshot is more than 15 minutes old

These files expire roughly 60 seconds after Claude Code refreshes them, and only exist while a session is active — so snapshots are collected opportunistically rather than continuously. The poll interval is configurable in Settings and defaults to 60 seconds; longer intervals will miss most collection windows.

### Heatmap

A GitHub-style activity heatmap showing your Claude usage intensity over time. Three layers:
- Cowork session count
- Input + output tokens
- Cache read + write tokens

Supports 3-month, 6-month, and 12-month views. Cells scale to fill the available width at any time range.

### Settings

Tabbed configuration panel:
- **General** — Log file path override, Claude Code data path override, launch on startup, minimize to tray, tray notifications, usage-limit polling interval and retention, and a "Moving to a new computer?" export/import section
- **Remote Sync** — Stubbed, not yet implemented
- **Dashboard** — Drag-to-reorder sidebar views, toggle visibility, set default landing view, show/hide individual Trends widgets
- **Data** — Live database stats (size, oldest records per table, journal mode), one-click SQLite backup, open data folder

The export/import section bundles a consistent database snapshot, portable settings, and your dashboard layout into a single zip. Importing merges insert-only — it never overwrites or deletes existing rows — so you can move between two machines repeatedly in both directions without losing anything.

### System Tray

The app runs in the system tray with a context menu showing live session count and today's cost. Closing the window minimizes to tray by default (configurable in Settings). Tray notifications fire for stale chat imports.

## Data sources

| Source | How it's collected | Automatic? |
|--------|-------------------|------------|
| **Claude Code** | Parses JSONL session files from `~/.claude/projects/` | Yes — scans on startup + every 5 min |
| **Claude Desktop (Cowork)** | Tails `main.log` from Claude Desktop's app data directory | Yes — starts on app launch |
| **claude.ai chat history** | Imports from a manually downloaded data export ZIP | No — one-time manual import per export |
| **Subscription usage limits** | Polls the usage-limit files Claude Code writes during an active session | Yes — every 60s by default, while a session is running |

All data is stored locally in a SQLite database at `%APPDATA%\claude-usage-monitor\ClaudeUsageMonitor\usage.db`. Nothing leaves your machine.

Settings and dashboard layout live alongside it as `settings.json` and `dashboard.json`. Installing a new version never touches any of these, and uninstalling leaves them in place.

## Platform support

**Windows is the only platform with pre-built installers today.** The release pipeline produces an NSIS installer for 64-bit Windows.

macOS and Linux builds are not currently produced, but the codebase has no Windows-specific runtime dependencies. If you're on another platform and want to try it, you can build from source (see [Development](#development)).

If there's interest in macOS or Linux builds, open an issue and let me know.

## Known limitations

- **Unsigned installer.** The Windows build is not code-signed, so SmartScreen will show a warning on first install. Click *More info → Run anyway*. This will be addressed when a signing certificate is added.
- **Cowork tracking requires Claude Desktop.** The LogWatcher tails Claude Desktop's `main.log`. If you don't use Claude Desktop, the Cowork-related views will be empty. Claude Code sessions are tracked independently.
- **Chat import is manual.** There's no API to pull claude.ai history automatically. You need to request a data export from claude.ai, download the ZIP, and import it each time you want updated chat data.
- **No remote sync.** The Remote Sync feature (push data to InfluxDB) is stubbed but not yet implemented. All data is local only.
- **Cost accuracy depends on the pricing table.** The built-in pricing covers Fable 5, Opus 5, Opus 4.8/4.7/4.6, Sonnet 5, Sonnet 4.6, and Haiku 4.5. If Anthropic changes pricing or you use a model not in the table, costs may be inaccurate — unknown models log a warning rather than silently costing $0.00. A cost recalculation button is available in Settings if the pricing table is updated in a new release.
- **Claude Desktop log format changes.** The LogWatcher parses specific patterns from `main.log`. If Anthropic changes the log format, Cowork tracking may break until a parser update is released. The app shows a health warning banner if it detects parsing issues.
- **JSONL cleanup period.** Claude Code can be configured to delete old session files. If `cleanupPeriodDays` is set low, historical data is lost before the app can import it. A banner warns you if this is set to 30 days or fewer.

## Feedback and issues

This is in active development and I'm looking for feedback. If you find a bug, have a feature request, or something doesn't work the way you'd expect, please [open an issue](../../issues). Screenshots and reproduction steps are always appreciated.

## Development

### Prerequisites

- Node.js 22+ (CI builds on 22)
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
| `npm run rc:patch` / `rc:minor` / `rc:major` | Cut the next release candidate from a release branch |
| `npm run release:final` | Promote the current RC to its stable version and open the release PR |

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
    contexts/        # Dashboard config and topbar providers
    hooks/           # useApi — the shared fetch/loading/error hook
    styles/          # Design tokens and global stylesheet
    utils/           # Shared display formatters
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

Releases are cut by GitHub Actions from branch merges — no one pushes tags by hand, and the tag is created by CI at publish time.

Each version gets a release branch (`vX.Y.Z/main`) cut from `main`. Release candidates are cut from that branch and publish as prereleases; promoting the RC to its stable version opens a PR into `main`, and merging it publishes the stable release. The installer appears under [Releases](../../releases) once the build finishes (~5-10 min).

## License

MIT

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

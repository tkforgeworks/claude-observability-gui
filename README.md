# COG — Claude Observability GUI

**COG** (formerly *Claude Usage Monitor*) is a free, local-first desktop app that tracks your Claude AI usage across **Claude Code**, **Claude Desktop (Cowork)**, and **claude.ai chat exports**. All data stays on your machine in a local SQLite database — nothing is sent anywhere.

Built with Electron, React, TypeScript, and better-sqlite3.

> Pre-built packages are available for 64-bit Windows (NSIS installer) and Linux (deb + AppImage). See [Platform Support](#platform-support) for details.

## Why this exists

Claude doesn't give you a single place to see how much you're spending, which projects eat the most tokens, or how your usage patterns look over time. This app fills that gap by pulling data from the sources Claude already writes to disk and turning it into dashboards you can actually use.

## Quick start

**Windows**

1. Download the latest `.exe` from the [Releases page](../../releases).
2. Run the installer. Windows SmartScreen will warn you because the binary is unsigned — click **More info → Run anyway** (see [Known Limitations](#known-limitations)).
3. The app installs per-user (no admin needed) and starts importing data automatically.

**Linux**

1. Download the `.deb` (Debian/Ubuntu/Pop!_OS) or `.AppImage` (any distro) from the [Releases page](../../releases).
2. Install with `sudo apt install ./tkforgeworks-cog-<version>.deb`, or make the AppImage executable and run it directly. The deb upgrades in place when you install a newer version, and upgrading from a pre-2.0 `claude-usage-monitor` deb removes the old package automatically (`Conflicts:`/`Replaces:`).
3. Tray features need a StatusNotifier/AppIndicator host with working menu support — this varies a lot across Linux desktops; see [System Tray](#system-tray).
4. Launch from your desktop's app grid (or `gtk-launch tkforgeworks-cog`). Running the binary directly in a terminal keeps it attached to that terminal — useful for watching logs, but closing the terminal kills the app.

That's it. Claude Code session data is picked up from `~/.claude/projects/` within a few minutes. Cowork tracking (Windows only) starts as soon as Claude Desktop's `main.log` is found. Chat history requires a one-time manual import (see below).

**Upgrading from 1.x (Claude Usage Monitor)?** Your database and settings are migrated automatically on COG's first launch — the old data directory is left in place as a backup. On Linux the deb replaces the old package. On Windows the renamed installer counts as a new product, so the old "Claude Usage Monitor" entry stays in Apps until you uninstall it yourself (uninstalling it does not touch your data).

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

Projects are matched by filesystem path, so Code and Cowork sessions for the same project directory are rolled up together automatically. Case sensitivity follows the path's origin: Windows-style paths match case-insensitively, Linux paths match exactly (case-distinct directories stay separate projects).

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
- **General** — Log file path override, Claude Code data path override, launch on startup (on Linux this creates an XDG autostart entry that starts the app in the tray), minimize to tray, tray notifications, usage-limit polling interval and retention, and a "Moving to a new computer?" export/import section
- **Remote Sync** — Stubbed, not yet implemented
- **Dashboard** — Drag-to-reorder sidebar views, toggle visibility, set default landing view, show/hide individual Trends widgets
- **Data** — Live database stats (size, oldest records per table, journal mode), one-click SQLite backup, open data folder

The export/import section bundles a consistent database snapshot, portable settings, and your dashboard layout into a single zip. Importing merges insert-only — it never overwrites or deletes existing rows — so you can move between two machines repeatedly in both directions without losing anything.

### System Tray

The app runs in the system tray with a context menu showing live session count and today's cost. On Windows, closing the window minimizes to tray by default; on Linux, closing quits the app unless you enable the tray option in Settings.

On Linux the tray depends on your desktop providing two things: a StatusNotifier host (renders the icon) and a working DBusMenu implementation (opens the menu). Support varies:

- **KDE Plasma** — full support built in (icon, menu, tooltip).
- **GNOME** — no tray host at all without an AppIndicator/KStatusNotifierItem extension.
- **COSMIC (Pop!_OS 24.04)** — renders the icon but currently never opens the menu, and tooltips aren't shown (upstream applet limitation).
- **sway** — works with the default swaybar; a custom bar without a tray module means no host, and the icon silently appears nowhere.
- **Hyprland** — ships no tray; it depends entirely on your bar. Waybar's tray module has known gaps with Electron app menus. Quickshell supports the full tray + menu protocol, but only if your shell config actually implements a tray (wiring `SystemTray` items to a `QsMenuAnchor`/`QsMenuOpener`).

The app falls back to quitting on close when its tray icon fails to load, but it cannot detect a desktop with no tray host at all — and a visible icon is not proof the menu works (see COSMIC and Waybar above). Only enable minimize-to-tray once you've confirmed clicking the icon opens the menu; if a window ever goes missing, launching the app again restores it. With launch-on-startup enabled on Linux, sign-in launches start hidden in the tray (open the window from the tray menu). Tray notifications fire for stale chat imports.

## Data sources

| Source | How it's collected | Automatic? |
|--------|-------------------|------------|
| **Claude Code** | Parses JSONL session files from `~/.claude/projects/` | Yes — scans on startup + every 5 min |
| **Claude Desktop (Cowork)** | Tails `main.log` from Claude Desktop's app data directory (Windows only) | Yes — starts on app launch on Windows |
| **claude.ai chat history** | Imports from a manually downloaded data export ZIP | No — one-time manual import per export |
| **Subscription usage limits** | Polls the usage-limit files Claude Code writes during an active session | Yes — every 60s by default, while a session is running |

All data is stored locally in a SQLite database (`%APPDATA%\tkforgeworks-cog\COG\usage.db` on Windows, `~/.config/tkforgeworks-cog/COG/usage.db` on Linux). Nothing leaves your machine.

Settings and dashboard layout live alongside it as `settings.json` and `dashboard.json`. Installing a new version never touches any of these, and uninstalling leaves them in place.

## Platform support

The release pipeline produces an NSIS installer for 64-bit Windows and AppImage + deb packages for 64-bit Linux.

Everything works identically on both platforms except Cowork tracking, which depends on Claude Desktop and is therefore Windows-only — on Linux the app says so in Settings instead of showing a connection error. Data lives in the platform's standard app-data location (`%APPDATA%` on Windows, `~/.config` on Linux) and can move between machines/platforms with Settings → General → data export/import.

macOS builds are not currently produced. If you want one, open an issue and let me know — the codebase is expected to build from source there (see [Development](#development)).

## Known limitations

- **Unsigned installer.** The Windows build is not code-signed, so SmartScreen will show a warning on first install. Click *More info → Run anyway*. This will be addressed when a signing certificate is added.
- **Cowork tracking requires Claude Desktop (Windows only).** The LogWatcher tails Claude Desktop's `main.log`, and Claude Desktop has no Linux build — on Linux the app marks the integration "Not Supported" in Settings rather than watching for a log that can't exist. If you don't use Claude Desktop, the Cowork-related views will be empty. Claude Code sessions are tracked independently on every platform.
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

[Apache License 2.0](LICENSE), with exclusions listed in [NOTICE](NOTICE):

- **Image assets are not covered by the Apache grant.** All raster and vector images in this repository (logos, wordmarks, app icons, illustrations, screenshots — `.svg`, `.png`, `.ico`, etc.) are Copyright Tim Klimpel (TK ForgeWorks), all rights reserved, unless a file or its directory states otherwise. Third-party assets keep their own licenses.
- **No trademark license.** "TK ForgeWorks" and the forge/anvil mark identify the origin of this work; forks and derivatives must not present themselves as TK ForgeWorks products.

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

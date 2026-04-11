# Claude Usage Monitor

A desktop application for tracking and analyzing Claude AI usage across Claude Code and Claude Desktop (Cowork). Built with Electron, React, and SQLite.

## Current Status

**v0.9.0 — First public installer.** The app ships as a Windows NSIS installer with a CI pipeline that publishes tagged releases to GitHub. Feature-complete for the 1.0 milestone: automatic JSONL import from Claude Code, live `main.log` tailing for Claude Desktop (Cowork), claude.ai chat history import, cost tracking, analytics, a dark-themed UI, system tray with live stats, database backup, and launch-on-startup. A 1.0.0 release will follow once an initial tester round is complete.

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

## Installation

> **Windows only.** The installer is built for 64-bit Windows. macOS and Linux builds are not currently produced.

1. Download the latest `Claude Usage Monitor Setup X.Y.Z.exe` from the [Releases page](../../releases).
2. Double-click the installer.
3. **Windows SmartScreen warning:** because the installer is not yet code-signed, Windows will show a blue *"Windows protected your PC"* dialog. Click **More info**, then **Run anyway**. This is expected — once a signing certificate is added in a future release, the warning will go away.
4. Follow the installer prompts. The app installs per-user (no admin required) to `%LOCALAPPDATA%\Programs\claude-usage-monitor` and creates Start Menu and desktop shortcuts.
5. User data (settings, dashboard config, usage database) lives in `%APPDATA%\Claude Usage Monitor\ClaudeUsageMonitor\` and is preserved across upgrades and uninstalls.

To enable auto-launch on Windows sign-in, open the app → **Settings → General → Startup** and check the box.

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
    services/        # LogWatcher, log line parser, log path discovery, launch-on-startup
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

## Releases

Tagged releases are built and published automatically via GitHub Actions:

- **`.github/workflows/ci.yml`** — runs typecheck + unit tests on every push to `main` and every PR (Ubuntu runner).
- **`.github/workflows/release.yml`** — runs on any tag matching `v*`, builds the NSIS installer on a Windows runner, and publishes it to a GitHub Release with auto-generated notes from commits since the previous tag. Tags containing a hyphen (e.g. `v0.9.0-rc.1`) are automatically flagged as pre-releases.

The installer appears under [Releases](../../releases) once the build finishes (~5-10 min). Builds are currently **unsigned** — Windows SmartScreen will show a warning that users can bypass via *More info → Run anyway*. See the Installation section above.

### Cutting a release

> **Note:** the command for version bumping is `npm version`, not `npm publish`. `npm publish` pushes to the public npm registry — do not run it for this project.

`npm version` in one step updates `package.json`, creates a commit, and creates an annotated `v<version>` git tag. Pushing that tag triggers the release workflow.

**Standard bump:**

```bash
npm version patch   # 0.9.0 → 0.9.1
npm version minor   # 0.9.0 → 0.10.0
npm version major   # 0.9.0 → 1.0.0
git push --follow-tags
```

`--follow-tags` pushes the commit and any annotated tags reachable from it in one shot. Without it, `git push` alone will not push the new tag.

**Pre-release / release-candidate tags:**

```bash
npm version 1.0.0-rc.1                # explicit
npm version prerelease --preid=rc     # auto-increment: 0.9.0 → 0.9.1-rc.0 → 0.9.1-rc.1 → ...
git push --follow-tags
```

Any tag containing a hyphen is automatically flagged as a GitHub pre-release by the workflow.

**First tag on a version that already exists in `package.json`:**

`npm version <x.y.z>` refuses to set the version to what it already is. For the very first tag on a fresh `package.json` version, tag manually:

```bash
git tag v0.9.0
git push origin main --follow-tags
```

**Gotcha — dirty working tree:**

`npm version` refuses to run if there are modified tracked files in the working tree (untracked files are fine). If you hit `Git working directory not clean`, either commit/stash the pending changes first, or bypass the check with:

```bash
npm version patch --force
```

`git tag` (used for the manual first-tag path above) does not enforce this check.

## Roadmap

| Version | Epic | Status |
|---------|------|--------|
| v0.1.0 | Foundation — JSONL import, Code sessions table, Today dashboard, cost engine | Complete |
| v0.2.0 | Live Cowork Tracking — Claude Desktop log watcher, cowork session/turn tracking | Complete |
| v0.3.0 | Trends & Analytics — 7 analytics widgets, heatmap, dashboard config | Complete |
| v0.4.0 | Chat Import — claude.ai ZIP importer, Chat History view | Complete |
| v0.5.0 | Polish & Packaging — Tray notifications, DB backup, status banners, UI polish | Complete |
| **v0.9.0** | **First public installer — NSIS installer, launch-on-startup, CI/CD pipeline, GitHub Releases** | **Current** |
| v1.0.0 | First stable release — code signing, tester feedback incorporated | Planned |

## License

MIT

## Author

Tim Klimpel / [tkforgeworks](https://github.com/tkforgeworks)

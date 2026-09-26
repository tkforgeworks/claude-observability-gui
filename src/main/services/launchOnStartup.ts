/**
 * Launch-on-startup, per platform (CGUI-78).
 *
 * Windows/macOS go through `app.setLoginItemSettings`. Linux has no such
 * API — the XDG autostart convention is a .desktop file in
 * `~/.config/autostart/`, which this module writes/removes directly.
 *
 * The autostart Exec line passes `--hidden` so login launches start in the
 * tray instead of opening a window over the user's session: the app's value
 * at login is background collection (usage_snapshots is the one stream with
 * nothing to backfill later). main.ts honours the flag only when the tray
 * is viable (CGUI-77) — a launch that can't show a tray shows the window.
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

/** Keep in sync with packaging identity (renamed at the CGUI-54 rebrand). */
const AUTOSTART_FILE = 'tkforgeworks-cog.desktop';

/**
 * Marker key stamped into every entry this module writes (CGUI-93). The
 * filename collides with what GNOME Tweaks / any XDG "Startup Applications"
 * tool produces when a user autostarts the installed app themselves, so
 * `applyLaunchOnStartup(false)` — which runs on every launch with the
 * default setting — must only ever remove entries that carry this key.
 *
 * Deliberately kept at its historical value through the CGUI-54 rebrand:
 * legacyMigration uses it to recognise (and clean up) pre-rebrand entries
 * this module wrote under the old filename.
 */
export const MANAGED_KEY = 'X-ClaudeUsageMonitor-Managed';

export function autostartFilePath(): string {
  // app.getPath('appData') on Linux is $XDG_CONFIG_HOME or ~/.config
  return path.join(app.getPath('appData'), 'autostart', AUTOSTART_FILE);
}

/**
 * Quotes a path as a single Desktop Entry `Exec` argument (CGUI-93).
 *
 * Two escaping layers per the freedesktop Desktop Entry spec: inside a
 * double-quoted argument `"`, `` ` ``, `$` and `\` are backslash-escaped, and
 * the whole value is then a desktop-file string in which `\` itself is
 * written `\\` — so a literal backslash ends up as four. `%` introduces a
 * field code anywhere in Exec and is written `%%`. AppImages live wherever
 * the user saved them, so paths like `~/Apps/100%/` are reachable.
 */
export function quoteExecArg(value: string): string {
  const quoted = value.replace(/[\\"`$]/g, (c) => '\\' + c);
  const fileLevel = quoted.replace(/\\/g, '\\\\');
  return '"' + fileLevel.replace(/%/g, '%%') + '"';
}

/**
 * A stable launcher for the running AppImage, if the user started it through
 * one (CGUI-140).
 *
 * The AppImage runtime resolves APPIMAGE to the real file, e.g.
 * `~/.local/opt/cog/2.0.0-rc.3/tkforgeworks-cog-2.0.0-rc.3.AppImage`, even
 * when the app was launched through a symlink like `~/.local/bin/cog` that an
 * install/upgrade script repoints at each new version. Writing APPIMAGE into
 * the autostart entry pins login launches to the old version until the new
 * one is opened by hand, and breaks them outright if the old file is pruned
 * first. ARGV0 carries the path as invoked (relative ones against OWD, the
 * runtime's original working directory; bare names via PATH): when that is a
 * different path resolving to the same file, it's the one that survives
 * upgrades.
 */
export function stableAppImageLauncher(
  appImage: string,
  argv0: string | undefined,
  env: { OWD?: string; PATH?: string } = process.env,
): string | null {
  if (!argv0) return null;

  let target: string;
  try {
    target = fs.realpathSync(appImage);
  } catch {
    return null;
  }

  const candidates = argv0.includes('/')
    ? [path.resolve(env.OWD ?? process.cwd(), argv0)]
    : (env.PATH ?? '').split(':').filter(Boolean).map((dir) => path.join(dir, argv0));

  for (const candidate of candidates) {
    if (candidate === target || candidate === appImage) continue;
    try {
      if (fs.realpathSync(candidate) === target) return candidate;
    } catch {
      // not on this PATH entry / dangling — keep looking
    }
  }
  return null;
}

/** The executable path a login launch should run. */
export function resolveLaunchPath(): string {
  // For AppImage launches process.execPath points inside the transient
  // squashfs mount; APPIMAGE carries the persistent file path, and a stable
  // launcher pointing at it beats both (CGUI-140).
  const appImage = process.env.APPIMAGE;
  if (!appImage) return process.execPath;
  return stableAppImageLauncher(appImage, process.env.ARGV0) ?? appImage;
}

export function buildAutostartEntry(): string {
  const exec = resolveLaunchPath();
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=COG',
    'Comment=COG (Claude Observability GUI) - Claude AI usage tracking desktop application',
    `Exec=${quoteExecArg(exec)} --hidden`,
    'X-GNOME-Autostart-enabled=true',
    `${MANAGED_KEY}=true`,
    '',
  ].join('\n');
}

/** True when the entry at `file` was written by this module (carries MANAGED_KEY). */
export function isManagedEntry(file: string): boolean {
  try {
    return fs.readFileSync(file, 'utf-8').includes(`${MANAGED_KEY}=true`);
  } catch {
    return false;
  }
}

/**
 * Applies the launch-on-startup preference. Called on app start and from the
 * `settings:update` IPC handler whenever the flag is present in the patch.
 */
export function applyLaunchOnStartup(enabled: boolean): void {
  if (process.platform === 'linux') {
    // Dev never writes an entry — autostarting `electron .` from a repo
    // checkout is not useful, and dev has never written one to remove.
    if (!app.isPackaged) return;
    const file = autostartFilePath();
    try {
      if (enabled) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, buildAutostartEntry());
      } else if (isManagedEntry(file)) {
        // A same-named entry the user created themselves (GNOME Tweaks copies
        // the installed .desktop under this exact filename) is not ours to
        // delete — leave it and let the OS keep autostarting the app.
        fs.rmSync(file, { force: true });
      }
    } catch (err) {
      console.error('[launchOnStartup] Failed to update autostart entry:', err);
    }
    return;
  }

  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
  });
}

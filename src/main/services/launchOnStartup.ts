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

/** Keep in sync with packaging identity — changes at the CGUI-54 rebrand. */
const AUTOSTART_FILE = 'claude-usage-monitor.desktop';

export function autostartFilePath(): string {
  // app.getPath('appData') on Linux is $XDG_CONFIG_HOME or ~/.config
  return path.join(app.getPath('appData'), 'autostart', AUTOSTART_FILE);
}

export function buildAutostartEntry(): string {
  // For AppImage launches process.execPath points inside the transient
  // squashfs mount; APPIMAGE carries the persistent file path.
  const exec = process.env.APPIMAGE ?? process.execPath;
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Claude Usage Monitor',
    'Comment=Claude AI usage tracking desktop application',
    `Exec="${exec}" --hidden`,
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n');
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
      } else {
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

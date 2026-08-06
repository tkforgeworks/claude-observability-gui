/**
 * System tray icon and context menu.
 * @see §9 "System Tray" wireframe in 04-wireframes.md
 */

import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import type { UsageSnapshot } from '../shared/ipc-types';

let tray: Tray | null = null;

/**
 * Whether the tray was created with a real (non-empty) icon. An empty-icon
 * tray renders as an invisible slot on Linux, so a window hidden "to tray"
 * would be unreachable — the close handler falls back to quitting instead
 * (CGUI-77).
 */
let trayViable = false;

export function isTrayViable(): boolean {
  return trayViable;
}

/**
 * Creates the system tray icon with a right-click context menu.
 * Should be called once from main.ts after the app is ready.
 *
 * Context menu structure (per wireframe §9):
 *   Open Dashboard
 *   ──────────────
 *   Today: N sessions  (placeholder until query layer is implemented)
 *   Cost:  $X.XX       (placeholder)
 *   ──────────────
 *   Sync: ● OK         (placeholder)
 *   ──────────────
 *   Quit
 */
export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icon.ico');
  let icon = nativeImage.createFromPath(iconPath);
  trayViable = !icon.isEmpty();
  if (icon.isEmpty()) {
    console.warn(`[tray] Icon not found at ${iconPath}, using empty placeholder`);
    icon = nativeImage.createEmpty();
  } else {
    // Downscale the 256×256 app icon for the system tray slot
    icon = icon.resize({ width: 16, height: 16, quality: 'best' });
  }

  tray = new Tray(icon);
  tray.setToolTip('Claude Usage Monitor');

  updateTrayMenu(mainWindow);

  tray.on('double-click', () => {
    showMainWindow(mainWindow);
  });

  return tray;
}

/**
 * Rebuilds the tray context menu with current stats.
 * Called on startup and after each data refresh.
 *
 * @see §9 wireframe — tray menu items
 */
export function updateTrayMenu(
  mainWindow: BrowserWindow,
  stats?: { sessionCount?: number; costUsd?: number; syncOk?: boolean; usageSnapshot?: UsageSnapshot }
): void {
  if (!tray) return;

  const sessionLabel = stats?.sessionCount != null
    ? `Today: ${stats.sessionCount} session${stats.sessionCount !== 1 ? 's' : ''}`
    : 'Today: loading...';

  const costLabel = stats?.costUsd != null
    ? `Cost:  $${stats.costUsd.toFixed(2)}`
    : 'Cost:  loading...';

  const fiveHourLabel = formatUsageLabel('5h', stats?.usageSnapshot?.five_hour_pct, stats?.usageSnapshot?.five_hour_resets_at);
  const sevenDayLabel = formatUsageLabel('7d', stats?.usageSnapshot?.seven_day_pct, stats?.usageSnapshot?.seven_day_resets_at);

  const syncLabel = stats?.syncOk != null
    ? (stats.syncOk ? 'Sync: ● OK' : 'Sync: ● Offline')
    : 'Sync: disabled';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Dashboard',
      click: () => showMainWindow(mainWindow),
    },
    { type: 'separator' },
    { label: sessionLabel, enabled: false },
    { label: costLabel, enabled: false },
    { label: fiveHourLabel, enabled: false },
    { label: sevenDayLabel, enabled: false },
    { type: 'separator' },
    { label: syncLabel, enabled: false },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function formatUsageLabel(prefix: string, pct?: number, resetsAt?: string | null): string {
  if (pct == null) return `${prefix}: --`;
  if (!resetsAt) return `${prefix}: ${pct.toFixed(1)}% · no limit`;
  const resetMs = new Date(resetsAt).getTime() - Date.now();
  const effectivePct = resetMs <= 0 ? 0 : pct;
  const pctStr = `${prefix}: ${effectivePct.toFixed(1)}%`;
  if (resetMs <= 0) return `${pctStr} · reset`;
  return `${pctStr} · resets ${formatDuration(resetMs)}`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Shows and focuses the main window, restoring it if minimised.
 */
function showMainWindow(mainWindow: BrowserWindow): void {
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

/**
 * Destroys the tray icon. Should be called on app quit.
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
  trayViable = false;
}

/**
 * System tray icon and context menu.
 * @see §9 "System Tray" wireframe in 04-wireframes.md
 */

import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron';
import path from 'path';

let tray: Tray | null = null;

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
  // TODO: replace placeholder icon with real icon asset
  // Icon should be a 16×16 or 32×32 ICO/PNG file at assets/icon.png
  const iconPath = path.join(app.getAppPath(), 'assets', 'tray-icon.png');
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch {
    // Fallback to empty image during development before assets are created
    icon = nativeImage.createEmpty();
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
  stats?: { sessionCount?: number; costUsd?: number; syncOk?: boolean }
): void {
  if (!tray) return;

  // TODO: replace placeholder labels with real values from stats parameter
  // once queryTodaySummary() and InfluxSync.getStatus() are implemented
  const sessionLabel = stats?.sessionCount != null
    ? `Today: ${stats.sessionCount} session${stats.sessionCount !== 1 ? 's' : ''}`
    : 'Today: loading...';

  const costLabel = stats?.costUsd != null
    ? `Cost:  $${stats.costUsd.toFixed(2)}`
    : 'Cost:  loading...';

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
}

/**
 * Electron main process entry point.
 * Responsibilities:
 * - Create BrowserWindow and load renderer
 * - System tray with minimize-to-tray on close
 * - Initialise SQLite database and run migrations
 * - Register IPC handlers
 * - Start background services (JSONL importer, log watcher) — stubs for now
 */

import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import path from 'path';
import type { LogConnectionStatus } from '../shared/ipc-types';
import { initDatabase, closeDatabase } from './db/database';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { ensureConfigFiles, loadSettings } from './config/configStore';
import { createTray, destroyTray, updateTrayMenu } from './tray';
import { queryTodaySummary } from './db/queries';
import { JsonlImporter } from './importers/jsonlImporter';
import { discoverLogPath, getLogPathStatus } from './services/logPathDiscovery';
import { LogWatcher } from './services/logWatcher';
import { UsageLimitWatcher } from './services/usageLimitWatcher';
import { applyLaunchOnStartup } from './services/launchOnStartup';
import { queryLatestUsageSnapshot } from './db/queries';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let importerInterval: ReturnType<typeof setInterval> | null = null;
let stalenessInterval: ReturnType<typeof setInterval> | null = null;
let logWatcher: LogWatcher | null = null;
let usageLimitWatcher: UsageLimitWatcher | null = null;
let stalenessNotified = false;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createMainWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    title: 'Claude Usage Monitor',
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false, // Show only after content is loaded to avoid flash
  });

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    // In development: load from webpack-dev-server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Close behavior (CGUI-62): hide to tray or quit per the user's setting.
  // Read at close time so a change in Settings applies without a restart.
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    if (loadSettings().minimizeToTrayOnClose) {
      event.preventDefault();
      mainWindow?.hide();
    } else {
      // Let the close proceed as a full quit, same as tray Quit
      isQuitting = true;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// Windows: set the AppUserModelID so the taskbar groups this process under the
// app's own identity and picks up the BrowserWindow icon instead of electron.exe's
// embedded default. Must match the `appId` in package.json's electron-builder config.
if (process.platform === 'win32') {
  // Dev gets a '.dev' suffix (CGUI-64): with the packaged AUMID, Windows
  // matches dev windows to the installed app's Start Menu shortcut, groups
  // them onto its taskbar button, and shows the shortcut's (old) icon
  // instead of the window icon. The packaged ID must match build.appId.
  app.setAppUserModelId(
    app.isPackaged
      ? 'com.tkforgeworks.claude-usage-monitor'
      : 'com.tkforgeworks.claude-usage-monitor.dev'
  );
}

// Dev/prod data isolation (CGUI-64): package.json has no top-level
// productName, so dev and the installed build otherwise resolve the SAME
// userData directory (%APPDATA%\claude-usage-monitor) and fight over the
// Chromium cache profile and usage.db. Must run before anything consumes
// userData (config files, database, window/session).
if (!app.isPackaged) {
  app.setPath('userData', app.getPath('userData') + '-dev');
}

// Single-instance lock (CGUI-63). Must come after the userData override —
// the lock is scoped to the userData path, which is exactly what lets a dev
// instance and an installed build run side by side while duplicate launches
// of the SAME variant hand off to the existing instance instead of fighting
// over the Chromium cache and usage.db.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Surface the existing window — including when it's hidden to tray
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  // Create config files with defaults if they don't exist
  ensureConfigFiles();

  // Apply launch-on-startup preference to OS login items
  applyLaunchOnStartup(loadSettings().launchOnStartup);

  // Initialise database — must happen before IPC handlers are registered
  const db = initDatabase();

  // Register all IPC handlers
  registerIpcHandlers(db);

  // Create main window
  const win = createMainWindow();

  // Safe wrapper — the BrowserWindow may already be destroyed when events
  // fire during app teardown (stop() emits 'disconnected' from will-quit).
  const sendToRenderer = (channel: string, payload: unknown): void => {
    if (win.isDestroyed() || win.webContents.isDestroyed()) return;
    win.webContents.send(channel, payload);
  };

  // Window control IPC (frameless title bar)
  ipcMain.on('window:minimize', () => win.minimize());
  ipcMain.on('window:maximize', () => {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', () => win.close());
  ipcMain.on('window:quit', () => { isQuitting = true; app.quit(); });
  ipcMain.handle('window:isMaximized', () => win.isMaximized());

  win.on('maximize', () => sendToRenderer('window:maximizeChanged', true));
  win.on('unmaximize', () => sendToRenderer('window:maximizeChanged', false));

  // Create system tray icon
  createTray(win);

  // Discover Claude Desktop log path (MSIX auto-discovery)
  discoverLogPath();

  // Tray menu refresh helper — updates session count, cost, and usage
  const refreshTray = () => {
    try {
      const today = queryTodaySummary(db);
      const usage = queryLatestUsageSnapshot(db);
      updateTrayMenu(win, {
        sessionCount: today.sessionCount,
        costUsd: today.codeCostUsd ?? undefined,
        usageSnapshot: usage ?? undefined,
      });
    } catch (err) {
      console.error('[main] Tray refresh failed:', err);
    }
  };

  // Start LogWatcher — tails Claude Desktop main.log for new lines
  logWatcher = new LogWatcher(db);

  logWatcher.on('event', (event) => {
    sendToRenderer('logWatcher:newEvent', event);
    if (!win.isDestroyed()) refreshTray();
  });
  logWatcher.on('healthStatus', (status) => {
    sendToRenderer('logWatcher:healthStatus', status);
  });
  logWatcher.on('connected', (logPath: string) => {
    sendToRenderer('logWatcher:connectionStatus', {
      connected: true,
      path: logPath,
      reason: null,
    });
  });
  logWatcher.on('disconnected', (reason: string) => {
    sendToRenderer('logWatcher:connectionStatus', {
      connected: false,
      path: null,
      reason,
    });
  });
  logWatcher.start();

  // Retry handler — re-runs discovery, restarts the watcher, and returns the
  // resulting connection state. The existing connected/disconnected listeners
  // also broadcast the new state to any mounted renderers.
  ipcMain.handle('logWatcher:retry', async (): Promise<LogConnectionStatus> => {
    if (!logWatcher) {
      return { connected: false, path: null, reason: 'LogWatcher not initialised' };
    }
    console.log('[main] logWatcher:retry requested');
    discoverLogPath();
    if (logWatcher.watching) {
      await logWatcher.stop();
    }
    await logWatcher.start();
    const status = getLogPathStatus();
    return {
      connected: logWatcher.watching,
      path: logWatcher.watching ? status.path : null,
      reason: logWatcher.watching
        ? null
        : status.source === 'not-found'
          ? 'Claude Desktop log not found — is Claude Desktop installed?'
          : `Log path invalid: ${status.path ?? 'unknown'}`,
    };
  });

  // Start JSONL importer: scan on startup, then every 5 minutes
  const importer = new JsonlImporter(db);

  const runScan = async () => {
    win.webContents.send('jsonlImporter:scanStarted');
    try {
      const summary = await importer.scan();
      win.webContents.send('jsonlImporter:scanComplete', summary);
    } catch (err) {
      console.error('[main] JSONL scan failed:', err);
    }
    refreshTray();
  };

  runScan();
  importerInterval = setInterval(runScan, 5 * 60 * 1000);

  // Start UsageLimitWatcher — polls Claude Code's cached usage-limit files
  const settings = loadSettings();
  if (settings.usageLimitPollingEnabled) {
    usageLimitWatcher = new UsageLimitWatcher(db);
    usageLimitWatcher.on('snapshot', (snapshot) => {
      sendToRenderer('usageLimitWatcher:snapshot', snapshot);
      refreshTray();
    });
    usageLimitWatcher.on('error', (err) => {
      console.error('[main] Usage limit poll error:', err);
    });
    usageLimitWatcher.start(settings.usageLimitPollIntervalMs);
  }

  // Chat import staleness notification
  const checkChatStaleness = () => {
    if (stalenessNotified) return;
    const settings = loadSettings();
    if (!settings.showTrayNotifications) {
      console.log('[staleness] Notifications disabled in settings');
      return;
    }
    if (!settings.lastChatImportAt) {
      console.log('[staleness] No chat import yet, skipping');
      return;
    }

    const daysSince = (Date.now() - new Date(settings.lastChatImportAt).getTime()) / 86_400_000;
    const threshold = settings.chatStalenessDays ?? 14;
    console.log(`[staleness] Last import ${Math.floor(daysSince)} days ago, threshold ${threshold}`);
    if (daysSince <= threshold) return;

    stalenessNotified = true;
    const notification = new Notification({
      title: 'Chat Import Data is Stale',
      body: `Your last claude.ai import was ${Math.floor(daysSince)} days ago. Click to update.`,
    });
    notification.on('click', () => {
      if (win) {
        win.show();
        win.focus();
        win.webContents.send('navigate', '/chat');
      }
    });
    notification.show();
  };
  setTimeout(checkChatStaleness, 10_000); // Check 10s after startup
  stalenessInterval = setInterval(checkChatStaleness, 60 * 60 * 1000); // Then every hour

  app.on('activate', () => {
    // macOS: re-create window if dock icon clicked with no open windows
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (importerInterval) clearInterval(importerInterval);
  if (stalenessInterval) clearInterval(stalenessInterval);
  if (logWatcher) logWatcher.stop();
  if (usageLimitWatcher) usageLimitWatcher.stop();
  ipcMain.removeHandler('logWatcher:retry');
  ipcMain.removeHandler('window:isMaximized');
  ipcMain.removeAllListeners('window:minimize');
  ipcMain.removeAllListeners('window:maximize');
  ipcMain.removeAllListeners('window:close');
  ipcMain.removeAllListeners('window:quit');
  unregisterIpcHandlers();
  destroyTray();
  closeDatabase();
});

// Keep the app running when all windows are closed (tray behaviour)
app.on('window-all-closed', () => {
  // On Windows/Linux: do NOT quit when window is closed — stay in tray
  // On macOS: standard behaviour is to stay running, handled by 'activate'
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});

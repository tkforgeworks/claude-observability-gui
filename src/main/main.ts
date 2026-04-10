/**
 * Electron main process entry point.
 * Responsibilities:
 * - Create BrowserWindow and load renderer
 * - System tray with minimize-to-tray on close
 * - Initialise SQLite database and run migrations
 * - Register IPC handlers
 * - Start background services (JSONL importer, log watcher) — stubs for now
 */

import { app, BrowserWindow, Notification } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './db/database';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { ensureConfigFiles, loadSettings } from './config/configStore';
import { createTray, destroyTray, updateTrayMenu } from './tray';
import { queryTodaySummary } from './db/queries';
import { JsonlImporter } from './importers/jsonlImporter';
import { discoverLogPath } from './services/logPathDiscovery';
import { LogWatcher } from './services/logWatcher';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let importerInterval: ReturnType<typeof setInterval> | null = null;
let stalenessInterval: ReturnType<typeof setInterval> | null = null;
let logWatcher: LogWatcher | null = null;
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
    title: 'Claude Usage Monitor',
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

  // Minimize to tray on close instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      // TODO: check settings.minimizeToTrayOnClose — if false, allow quit
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

app.whenReady().then(() => {
  // Create config files with defaults if they don't exist
  ensureConfigFiles();

  // Initialise database — must happen before IPC handlers are registered
  const db = initDatabase();

  // Register all IPC handlers
  registerIpcHandlers(db);

  // Create main window
  const win = createMainWindow();

  // Create system tray icon
  createTray(win);

  // Discover Claude Desktop log path (MSIX auto-discovery)
  discoverLogPath();

  // Tray menu refresh helper — updates session count and cost
  const refreshTray = () => {
    try {
      const today = queryTodaySummary(db);
      updateTrayMenu(win, {
        sessionCount: today.sessionCount,
        costUsd: today.codeCostUsd ?? undefined,
      });
    } catch (err) {
      console.error('[main] Tray refresh failed:', err);
    }
  };

  // Start LogWatcher — tails Claude Desktop main.log for new lines
  logWatcher = new LogWatcher(db);
  logWatcher.on('event', (event) => {
    win.webContents.send('logWatcher:newEvent', event);
    refreshTray();
  });
  logWatcher.on('healthStatus', (status) => {
    win.webContents.send('logWatcher:healthStatus', status);
  });
  logWatcher.start();

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

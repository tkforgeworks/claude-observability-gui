/**
 * Electron main process entry point.
 * Responsibilities:
 * - Create BrowserWindow and load renderer
 * - System tray with minimize-to-tray on close
 * - Initialise SQLite database and run migrations
 * - Register IPC handlers
 * - Start background services (JSONL importer, log watcher) — stubs for now
 */

import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initDatabase, closeDatabase } from './db/database';
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/handlers';
import { createTray, destroyTray } from './tray';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

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
  // Initialise database — must happen before IPC handlers are registered
  const db = initDatabase();

  // Register all IPC handlers
  registerIpcHandlers(db);

  // Create main window
  const win = createMainWindow();

  // Create system tray icon
  createTray(win);

  // TODO (v0.2): Start LogWatcher
  // const logWatcher = new LogWatcher(db);
  // logWatcher.start();

  // TODO (v0.2): Start JSONL importer scan cycle (every 5 minutes)
  // const importer = new JsonlImporter(db);
  // importer.scan().catch(console.error);
  // setInterval(() => importer.scan().catch(console.error), 5 * 60 * 1000);

  // TODO (v0.4): Start InfluxDB sync service
  // const influxSync = new InfluxSync(db);
  // influxSync.start();

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

/**
 * IPC handler registration for all typed channels.
 * Call registerIpcHandlers(db) once from main.ts after initDatabase().
 *
 * Channel naming convention: {domain}:{action}
 * @see §5 "IPC Contract" in architecture doc
 * @see src/shared/ipc-types.ts for request/response shapes
 */

import { ipcMain, shell } from 'electron';
import type Database from 'better-sqlite3';
import type {
  DateRange,
  AppSettings,
  DashboardConfig,
  SyncStatus,
  ImportSummary,
  ConfigPaths,
} from '../../shared/ipc-types';
import {
  queryCodeSessions,
  queryCodeSessionsByProject,
  queryTodaySummary,
  queryCoworkSessions,
  queryCoworkTurns,
  recalculateAllCosts,
  queryUnsyncedCounts,
} from '../db/queries';
import {
  loadSettings,
  updateSettings,
  loadDashboard,
  saveDashboard,
  getSettingsPath,
  getDashboardPath,
} from '../config/configStore';
import { getDatabasePath } from '../db/database';

/**
 * Registers all IPC invoke handlers (renderer → main → renderer).
 * Push channels (main → renderer) are emitted by services, not registered here.
 */
export function registerIpcHandlers(db: Database.Database): void {
  // -------------------------------------------------------------------------
  // codeSessions channels
  // -------------------------------------------------------------------------

  ipcMain.handle('codeSessions:getAll', (_event, range: DateRange) => {
    // TODO: validate range shape before forwarding
    return queryCodeSessions(db, range);
  });

  ipcMain.handle('codeSessions:getByDateRange', (_event, range: DateRange) => {
    return queryCodeSessions(db, range);
  });

  ipcMain.handle(
    'codeSessions:getByProject',
    (_event, project: string, range: DateRange) => {
      return queryCodeSessionsByProject(db, project, range);
    }
  );

  // -------------------------------------------------------------------------
  // coworkSessions channels
  // -------------------------------------------------------------------------

  ipcMain.handle('coworkSessions:getSummaryToday', () => {
    return queryTodaySummary(db);
  });

  ipcMain.handle('coworkSessions:getAll', (_event, range: DateRange) => {
    return queryCoworkSessions(db, range);
  });

  ipcMain.handle('coworkSessions:getTurns', (_event, sessionId: string) => {
    return queryCoworkTurns(db, sessionId);
  });

  // -------------------------------------------------------------------------
  // configPaths channels
  // -------------------------------------------------------------------------

  ipcMain.handle('configPaths:get', (): ConfigPaths => {
    const { app: electronApp } = require('electron');
    return {
      settingsPath: getSettingsPath(),
      dashboardPath: getDashboardPath(),
      databasePath: getDatabasePath(),
      userDataPath: electronApp.getPath('userData'),
    };
  });

  ipcMain.handle('configPaths:openFolder', (_event, folderPath: string) => {
    shell.openPath(folderPath);
  });

  // -------------------------------------------------------------------------
  // settings channels
  // -------------------------------------------------------------------------

  ipcMain.handle('settings:get', (): AppSettings => {
    return loadSettings();
  });

  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => {
    // TODO: safeStorage encryption for token fields before writing
    return updateSettings(partial);
  });

  // -------------------------------------------------------------------------
  // dashboard channels
  // -------------------------------------------------------------------------

  ipcMain.handle('dashboard:get', (): DashboardConfig => {
    return loadDashboard();
  });

  ipcMain.handle('dashboard:save', (_event, config: DashboardConfig) => {
    saveDashboard(config);
  });

  // -------------------------------------------------------------------------
  // chatImport channels
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'chatImport:start',
    (_event, filePath: string): ImportSummary => {
      // TODO: implement — call ExportImporter service with filePath
      // Returns ImportSummary with new/updated/error counts
      throw new Error('chatImport:start not yet implemented');
    }
  );

  // -------------------------------------------------------------------------
  // sync channels
  // -------------------------------------------------------------------------

  ipcMain.handle('sync:getStatus', (): SyncStatus => {
    // TODO: implement — query influxSync service for status + queryUnsyncedCounts(db)
    const counts = queryUnsyncedCounts(db);
    return {
      enabled: false,
      lastSyncAt: null,
      isOnline: false,
      pendingRows: counts,
    };
  });

  ipcMain.handle('sync:triggerNow', () => {
    // TODO: implement — invoke influxSync.syncNow()
    throw new Error('sync:triggerNow not yet implemented');
  });

  ipcMain.handle(
    'sync:setToken',
    (_event, profileId: string, token: string) => {
      // TODO: implement — encrypt token with safeStorage.encryptString(), persist to settings
      console.log('[ipc] sync:setToken received for profile', profileId);
    }
  );

  ipcMain.handle('sync:testConnection', (_event, profileId: string): boolean => {
    // TODO: implement — call influxSync.testConnection(profileId)
    return false;
  });

  // -------------------------------------------------------------------------
  // costs channels
  // -------------------------------------------------------------------------

  ipcMain.handle('costs:recalculate', () => {
    // TODO: implement — call recalculateAllCosts(db), then emit scan complete event
    recalculateAllCosts(db);
  });
}

/**
 * Removes all registered IPC handlers. Call on app quit to prevent leaks
 * in tests and during hot-reload in development.
 */
export function unregisterIpcHandlers(): void {
  const channels = [
    'configPaths:get',
    'configPaths:openFolder',
    'codeSessions:getAll',
    'codeSessions:getByDateRange',
    'codeSessions:getByProject',
    'coworkSessions:getSummaryToday',
    'coworkSessions:getAll',
    'coworkSessions:getTurns',
    'settings:get',
    'settings:update',
    'dashboard:get',
    'dashboard:save',
    'chatImport:start',
    'sync:getStatus',
    'sync:triggerNow',
    'sync:setToken',
    'sync:testConnection',
    'costs:recalculate',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

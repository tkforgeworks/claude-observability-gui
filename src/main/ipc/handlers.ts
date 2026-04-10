/**
 * IPC handler registration for all typed channels.
 * Call registerIpcHandlers(db) once from main.ts after initDatabase().
 *
 * Channel naming convention: {domain}:{action}
 * @see §5 "IPC Contract" in architecture doc
 * @see src/shared/ipc-types.ts for request/response shapes
 */

import { ipcMain, shell, dialog } from 'electron';
import type Database from 'better-sqlite3';
import type {
  DateRange,
  AppSettings,
  CleanupWarning,
  DashboardConfig,
  SyncStatus,
  ImportSummary,
  ConfigPaths,
  LogPathStatus,
} from '../../shared/ipc-types';
import {
  queryCodeSessions,
  queryCodeSessionsByProject,
  queryTodaySummary,
  queryTodayTimeline,
  queryCoworkSessions,
  queryCoworkTurns,
  queryWeeklyActivity,
  queryHeatmapData,
  queryCacheEfficiency,
  queryTurnDurationTrend,
  queryDailyCosts,
  querySessionDensity,
  queryModelMix,
  queryProjectTimeline,
  queryUsagePatterns,
  queryTableCounts,
  queryDatabaseStats,
  recalculateAllCosts,
  queryUnsyncedCounts,
  queryChatConversationCounts,
  queryChatStats,
  queryChatProjects,
  queryChatMemories,
  queryChatConversationHeatmap,
  queryChatProjectHeatmap,
} from '../db/queries';
import {
  loadSettings,
  updateSettings,
  loadDashboard,
  saveDashboard,
  resetDashboard,
  getSettingsPath,
  getDashboardPath,
} from '../config/configStore';
import { getDatabasePath } from '../db/database';
import { getLogPathStatus } from '../services/logPathDiscovery';
import { applyLaunchOnStartup } from '../services/launchOnStartup';
import { ChatExportImporter } from '../importers/chatExportImporter';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Registers all IPC invoke handlers (renderer → main → renderer).
 * Push channels (main → renderer) are emitted by services, not registered here.
 */
export function registerIpcHandlers(db: Database.Database): void {
  // -------------------------------------------------------------------------
  // dev channels
  // -------------------------------------------------------------------------

  ipcMain.handle('dev:clearDatabase', () => {
    // Delete children before parents to respect FK constraints
    const tables = ['cowork_turns', 'app_focus_events', 'cowork_sessions', 'code_sessions', 'app_sessions', 'chat_conversations', 'chat_projects', 'chat_memories'];
    const clear = db.transaction(() => {
      for (const table of tables) {
        db.exec(`DELETE FROM ${table}`);
      }
    });
    clear();
    console.log('[ipc] dev:clearDatabase — all data tables cleared');
  });

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

  ipcMain.handle('codeSessions:getCleanupWarning', (): CleanupWarning => {
    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
      if (!fs.existsSync(settingsPath)) {
        return { cleanupPeriodDays: null, warningNeeded: false };
      }
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const days = parsed.cleanupPeriodDays ?? null;
      return {
        cleanupPeriodDays: typeof days === 'number' ? days : null,
        warningNeeded: typeof days === 'number' && days <= 30,
      };
    } catch (err) {
      console.error('[ipc] Failed to read Claude settings for cleanupPeriodDays:', err);
      return { cleanupPeriodDays: null, warningNeeded: false };
    }
  });

  // -------------------------------------------------------------------------
  // coworkSessions channels
  // -------------------------------------------------------------------------

  ipcMain.handle('coworkSessions:getSummaryToday', () => {
    return queryTodaySummary(db);
  });

  ipcMain.handle('coworkSessions:getTimeline', () => {
    return queryTodayTimeline(db);
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
  // logPath channels
  // -------------------------------------------------------------------------

  ipcMain.handle('logPath:getStatus', (): LogPathStatus => {
    return getLogPathStatus();
  });

  // -------------------------------------------------------------------------
  // data channels
  // -------------------------------------------------------------------------

  ipcMain.handle('data:getTableCounts', (): Record<string, number> => {
    return queryTableCounts(db);
  });

  ipcMain.handle('data:getStats', () => {
    return queryDatabaseStats(db);
  });

  ipcMain.handle('data:backup', async () => {
    const now = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
      title: 'Backup Database',
      defaultPath: `usage-backup-${now}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) {
      return { success: false };
    }
    try {
      await db.backup(result.filePath);
      return { success: true, path: result.filePath };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ipc] data:backup failed:', message);
      return { success: false, error: message };
    }
  });

  ipcMain.handle('data:openFolder', () => {
    shell.showItemInFolder(getDatabasePath());
  });

  // -------------------------------------------------------------------------
  // settings channels
  // -------------------------------------------------------------------------

  ipcMain.handle('settings:get', (): AppSettings => {
    return loadSettings();
  });

  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => {
    // TODO: safeStorage encryption for token fields before writing
    const merged = updateSettings(partial);
    if (Object.prototype.hasOwnProperty.call(partial, 'launchOnStartup')) {
      applyLaunchOnStartup(merged.launchOnStartup);
    }
    return merged;
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

  ipcMain.handle('dashboard:reset', (): DashboardConfig => {
    return resetDashboard();
  });

  // -------------------------------------------------------------------------
  // chat channels
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'chat:getConversationCounts',
    (_event: unknown, groupBy: 'week' | 'month') => {
      return queryChatConversationCounts(db, groupBy);
    }
  );

  ipcMain.handle('chat:getStats', () => {
    return queryChatStats(db);
  });

  ipcMain.handle('chat:getProjects', () => {
    return queryChatProjects(db);
  });

  ipcMain.handle('chat:getMemories', () => {
    return queryChatMemories(db);
  });

  ipcMain.handle('chat:getConversationHeatmap', (_event: unknown, days: number) => {
    return queryChatConversationHeatmap(db, days);
  });

  ipcMain.handle('chat:getProjectHeatmap', (_event: unknown, days: number) => {
    return queryChatProjectHeatmap(db, days);
  });

  // -------------------------------------------------------------------------
  // dialog channels
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'dialog:openFile',
    async (_event, filters: { name: string; extensions: string[] }[]): Promise<string | null> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters,
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    }
  );

  // -------------------------------------------------------------------------
  // chatImport channels
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'chatImport:start',
    (_event, filePath: string): ImportSummary => {
      const importer = new ChatExportImporter(db);
      const summary = importer.import(filePath);

      // Persist import timestamp
      updateSettings({ lastChatImportAt: summary.scannedAt });

      return summary;
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

  // -------------------------------------------------------------------------
  // analytics channels
  // -------------------------------------------------------------------------

  ipcMain.handle('analytics:getWeeklyActivity', () => {
    return queryWeeklyActivity(db);
  });

  ipcMain.handle('analytics:getHeatmapData', (_event: unknown, days: number) => {
    return queryHeatmapData(db, days);
  });

  ipcMain.handle('analytics:getCacheEfficiency', (_event: unknown, days: number) => {
    return queryCacheEfficiency(db, days);
  });

  ipcMain.handle('analytics:getTurnDurationTrend', (_event: unknown, days: number) => {
    return queryTurnDurationTrend(db, days);
  });

  ipcMain.handle('analytics:getDailyCosts', (_event: unknown, days: number) => {
    return queryDailyCosts(db, days);
  });

  ipcMain.handle('analytics:getSessionDensity', (_event: unknown, days: number) => {
    return querySessionDensity(db, days);
  });

  ipcMain.handle('analytics:getModelMix', (_event: unknown, days: number) => {
    return queryModelMix(db, days);
  });

  ipcMain.handle('analytics:getProjectTimeline', (_event: unknown, days: number) => {
    return queryProjectTimeline(db, days);
  });

  ipcMain.handle('analytics:getUsagePatterns', (_event: unknown, days: number) => {
    return queryUsagePatterns(db, days);
  });
}

/**
 * Removes all registered IPC handlers. Call on app quit to prevent leaks
 * in tests and during hot-reload in development.
 */
export function unregisterIpcHandlers(): void {
  const channels = [
    'dev:clearDatabase',
    'configPaths:get',
    'configPaths:openFolder',
    'logPath:getStatus',
    'data:getTableCounts',
    'data:getStats',
    'data:backup',
    'data:openFolder',
    'codeSessions:getAll',
    'codeSessions:getByDateRange',
    'codeSessions:getByProject',
    'codeSessions:getCleanupWarning',
    'coworkSessions:getSummaryToday',
    'coworkSessions:getTimeline',
    'coworkSessions:getAll',
    'coworkSessions:getTurns',
    'settings:get',
    'settings:update',
    'dashboard:get',
    'dashboard:save',
    'dashboard:reset',
    'chatImport:start',
    'sync:getStatus',
    'sync:triggerNow',
    'sync:setToken',
    'sync:testConnection',
    'costs:recalculate',
    'analytics:getWeeklyActivity',
    'analytics:getHeatmapData',
    'analytics:getCacheEfficiency',
    'analytics:getTurnDurationTrend',
    'analytics:getDailyCosts',
    'analytics:getSessionDensity',
    'analytics:getModelMix',
    'analytics:getProjectTimeline',
    'analytics:getUsagePatterns',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

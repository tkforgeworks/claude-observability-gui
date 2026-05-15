/**
 * Electron preload script — contextBridge exposure.
 * Exposes window.api to the renderer process using contextBridge.
 * The renderer NEVER calls ipcRenderer.invoke() directly — it uses window.api.
 *
 * @see §5 "Preload script" in architecture doc
 * @see src/shared/ipc-types.ts for ElectronApi type definition
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  ElectronApi,
  CacheEfficiencyData,
  DailyCostData,
  ModelMixDay,
  ProjectAggregate,
  ProjectTimelineRow,
  SessionDensityDay,
  UsagePatternsData,
  TurnDurationDay,
  DailyActivity,
  HeatmapDay,
  DateRange,
  AppSettings,
  CleanupWarning,
  ConfigPaths,
  DashboardConfig,
  LogEvent,
  LogHealthStatus,
  LogConnectionStatus,
  LogPathStatus,
  ImportSummary,
  SyncStatus,
  ChatConversationCount,
  ChatStats,
  ChatProject,
  ChatMemoryEntry,
  ChatDayCount,
} from '../shared/ipc-types';

const api: ElectronApi = {
  // -------------------------------------------------------------------------
  // windowControls
  // -------------------------------------------------------------------------
  windowControls: {
    minimize() {
      ipcRenderer.send('window:minimize');
    },
    maximize() {
      ipcRenderer.send('window:maximize');
    },
    close() {
      ipcRenderer.send('window:close');
    },
    quit() {
      ipcRenderer.send('window:quit');
    },
    isMaximized(): Promise<boolean> {
      return ipcRenderer.invoke('window:isMaximized');
    },
  },

  // -------------------------------------------------------------------------
  // configPaths
  // -------------------------------------------------------------------------
  configPaths: {
    get(): Promise<ConfigPaths> {
      return ipcRenderer.invoke('configPaths:get');
    },
    openFolder(folderPath: string): Promise<void> {
      return ipcRenderer.invoke('configPaths:openFolder', folderPath);
    },
  },

  // -------------------------------------------------------------------------
  // logPath
  // -------------------------------------------------------------------------
  logPath: {
    getStatus(): Promise<LogPathStatus> {
      return ipcRenderer.invoke('logPath:getStatus');
    },
  },

  // -------------------------------------------------------------------------
  // logWatcher
  // -------------------------------------------------------------------------
  logWatcher: {
    retry(): Promise<LogConnectionStatus> {
      return ipcRenderer.invoke('logWatcher:retry');
    },
  },

  // -------------------------------------------------------------------------
  // data
  // -------------------------------------------------------------------------
  data: {
    getTableCounts(): Promise<Record<string, number>> {
      return ipcRenderer.invoke('data:getTableCounts');
    },
    getStats() {
      return ipcRenderer.invoke('data:getStats');
    },
    backup() {
      return ipcRenderer.invoke('data:backup');
    },
    openFolder() {
      ipcRenderer.invoke('data:openFolder');
    },
  },

  // -------------------------------------------------------------------------
  // dev
  // -------------------------------------------------------------------------
  dev: {
    clearDatabase(): Promise<void> {
      return ipcRenderer.invoke('dev:clearDatabase');
    },
  },

  // -------------------------------------------------------------------------
  // codeSessions
  // -------------------------------------------------------------------------
  codeSessions: {
    getAll(range: DateRange) {
      return ipcRenderer.invoke('codeSessions:getAll', range);
    },
    getByDateRange(range: DateRange) {
      return ipcRenderer.invoke('codeSessions:getByDateRange', range);
    },
    getByProject(project: string, range: DateRange) {
      return ipcRenderer.invoke('codeSessions:getByProject', project, range);
    },
    getCleanupWarning(): Promise<CleanupWarning> {
      return ipcRenderer.invoke('codeSessions:getCleanupWarning');
    },
  },

  // -------------------------------------------------------------------------
  // coworkSessions
  // -------------------------------------------------------------------------
  coworkSessions: {
    getSummaryToday() {
      return ipcRenderer.invoke('coworkSessions:getSummaryToday');
    },
    getTimeline() {
      return ipcRenderer.invoke('coworkSessions:getTimeline');
    },
    getAll(range: DateRange) {
      return ipcRenderer.invoke('coworkSessions:getAll', range);
    },
    getTurns(sessionId: string) {
      return ipcRenderer.invoke('coworkSessions:getTurns', sessionId);
    },
  },

  // -------------------------------------------------------------------------
  // settings
  // -------------------------------------------------------------------------
  settings: {
    get(): Promise<AppSettings> {
      return ipcRenderer.invoke('settings:get');
    },
    update(partial: Partial<AppSettings>): Promise<void> {
      return ipcRenderer.invoke('settings:update', partial);
    },
  },

  // -------------------------------------------------------------------------
  // dashboard
  // -------------------------------------------------------------------------
  dashboard: {
    get(): Promise<DashboardConfig> {
      return ipcRenderer.invoke('dashboard:get');
    },
    save(config: DashboardConfig): Promise<void> {
      return ipcRenderer.invoke('dashboard:save', config);
    },
    reset(): Promise<DashboardConfig> {
      return ipcRenderer.invoke('dashboard:reset');
    },
  },

  // -------------------------------------------------------------------------
  // chat
  // -------------------------------------------------------------------------
  chat: {
    getConversationCounts(groupBy: 'week' | 'month'): Promise<ChatConversationCount[]> {
      return ipcRenderer.invoke('chat:getConversationCounts', groupBy);
    },
    getStats(): Promise<ChatStats> {
      return ipcRenderer.invoke('chat:getStats');
    },
    getProjects(): Promise<ChatProject[]> {
      return ipcRenderer.invoke('chat:getProjects');
    },
    getMemories(): Promise<ChatMemoryEntry[]> {
      return ipcRenderer.invoke('chat:getMemories');
    },
    getConversationHeatmap(days: number): Promise<ChatDayCount[]> {
      return ipcRenderer.invoke('chat:getConversationHeatmap', days);
    },
    getProjectHeatmap(days: number): Promise<ChatDayCount[]> {
      return ipcRenderer.invoke('chat:getProjectHeatmap', days);
    },
  },

  // -------------------------------------------------------------------------
  // dialog
  // -------------------------------------------------------------------------
  dialog: {
    openFile(filters: { name: string; extensions: string[] }[]): Promise<string | null> {
      return ipcRenderer.invoke('dialog:openFile', filters);
    },
    getFilePath(file: File): string {
      return webUtils.getPathForFile(file);
    },
  },

  // -------------------------------------------------------------------------
  // chatImport
  // -------------------------------------------------------------------------
  chatImport: {
    start(filePath: string): Promise<ImportSummary> {
      return ipcRenderer.invoke('chatImport:start', filePath);
    },
  },

  // -------------------------------------------------------------------------
  // sync
  // -------------------------------------------------------------------------
  sync: {
    getStatus(): Promise<SyncStatus> {
      return ipcRenderer.invoke('sync:getStatus');
    },
    triggerNow(): Promise<void> {
      return ipcRenderer.invoke('sync:triggerNow');
    },
    setToken(profileId: string, token: string): Promise<void> {
      return ipcRenderer.invoke('sync:setToken', profileId, token);
    },
    testConnection(profileId: string): Promise<boolean> {
      return ipcRenderer.invoke('sync:testConnection', profileId);
    },
  },

  // -------------------------------------------------------------------------
  // costs
  // -------------------------------------------------------------------------
  costs: {
    recalculate(): Promise<void> {
      return ipcRenderer.invoke('costs:recalculate');
    },
  },

  // -------------------------------------------------------------------------
  // projects
  // -------------------------------------------------------------------------
  projects: {
    getAggregates(days: number): Promise<ProjectAggregate[]> {
      return ipcRenderer.invoke('projects:getAggregates', days);
    },
  },

  // -------------------------------------------------------------------------
  // analytics
  // -------------------------------------------------------------------------
  analytics: {
    getWeeklyActivity(): Promise<DailyActivity[]> {
      return ipcRenderer.invoke('analytics:getWeeklyActivity');
    },
    getHeatmapData(days: number): Promise<HeatmapDay[]> {
      return ipcRenderer.invoke('analytics:getHeatmapData', days);
    },
    getCacheEfficiency(days: number): Promise<CacheEfficiencyData[]> {
      return ipcRenderer.invoke('analytics:getCacheEfficiency', days);
    },
    getTurnDurationTrend(days: number): Promise<TurnDurationDay[]> {
      return ipcRenderer.invoke('analytics:getTurnDurationTrend', days);
    },
    getDailyCosts(days: number): Promise<DailyCostData[]> {
      return ipcRenderer.invoke('analytics:getDailyCosts', days);
    },
    getSessionDensity(days: number): Promise<SessionDensityDay[]> {
      return ipcRenderer.invoke('analytics:getSessionDensity', days);
    },
    getModelMix(days: number): Promise<{ days: ModelMixDay[]; models: string[] }> {
      return ipcRenderer.invoke('analytics:getModelMix', days);
    },
    getProjectTimeline(days: number): Promise<{ rows: ProjectTimelineRow[]; dateRange: string[] }> {
      return ipcRenderer.invoke('analytics:getProjectTimeline', days);
    },
    getUsagePatterns(days: number): Promise<UsagePatternsData> {
      return ipcRenderer.invoke('analytics:getUsagePatterns', days);
    },
  },

  // -------------------------------------------------------------------------
  // Push event subscriptions (main → renderer)
  // Returns an unsubscribe function for cleanup.
  // -------------------------------------------------------------------------
  onMaximizeChange(callback: (isMaximized: boolean) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, isMaximized: boolean) =>
      callback(isMaximized);
    ipcRenderer.on('window:maximizeChanged', handler);
    return () => ipcRenderer.removeListener('window:maximizeChanged', handler);
  },

  onLogWatcherEvent(callback: (event: LogEvent) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: LogEvent) =>
      callback(data);
    ipcRenderer.on('logWatcher:newEvent', handler);
    return () => ipcRenderer.removeListener('logWatcher:newEvent', handler);
  },

  onLogWatcherHealth(callback: (status: LogHealthStatus) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: LogHealthStatus) =>
      callback(data);
    ipcRenderer.on('logWatcher:healthStatus', handler);
    return () => ipcRenderer.removeListener('logWatcher:healthStatus', handler);
  },

  onLogWatcherConnection(callback: (status: LogConnectionStatus) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: LogConnectionStatus) =>
      callback(data);
    ipcRenderer.on('logWatcher:connectionStatus', handler);
    return () => ipcRenderer.removeListener('logWatcher:connectionStatus', handler);
  },

  onScanStarted(callback: () => void): () => void {
    const handler = () => callback();
    ipcRenderer.on('jsonlImporter:scanStarted', handler);
    return () => ipcRenderer.removeListener('jsonlImporter:scanStarted', handler);
  },

  onImportComplete(callback: (summary: ImportSummary) => void): () => void {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: ImportSummary
    ) => callback(data);
    ipcRenderer.on('jsonlImporter:scanComplete', handler);
    return () => ipcRenderer.removeListener('jsonlImporter:scanComplete', handler);
  },

  onSyncStatusChanged(callback: (status: SyncStatus) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, data: SyncStatus) =>
      callback(data);
    ipcRenderer.on('sync:statusChanged', handler);
    return () => ipcRenderer.removeListener('sync:statusChanged', handler);
  },

  onNavigate(callback: (path: string) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, path: string) =>
      callback(path);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
};

contextBridge.exposeInMainWorld('api', api);

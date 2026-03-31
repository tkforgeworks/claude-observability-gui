/**
 * TypeScript interfaces for all IPC channel request/response types.
 * Imported by both src/main/ipc/handlers.ts and src/preload/preload.ts
 * to provide compile-time verification of the IPC contract (§5 of architecture doc).
 *
 * Channel naming convention: {domain}:{action}
 */

// ---------------------------------------------------------------------------
// Shared value types
// ---------------------------------------------------------------------------

export interface DateRange {
  from: string; // ISO 8601 date string
  to: string;   // ISO 8601 date string
}

// ---------------------------------------------------------------------------
// Code Sessions
// ---------------------------------------------------------------------------

export interface CodeSession {
  id: number;
  session_id: string;
  project_path: string | null;
  model: string | null;
  slug: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
  cost_usd: number | null;
  started_at: string | null;
  ended_at: string | null;
}

// ---------------------------------------------------------------------------
// Cowork Sessions
// ---------------------------------------------------------------------------

export interface CoworkSession {
  id: number;
  session_id: string;
  cli_session_id: string | null;
  title: string | null;
  project_path: string | null;
  started_at: string;
  ended_at: string | null;
  turn_count: number;
  avg_turn_seconds: number | null;
}

export interface CoworkTurn {
  id: number;
  session_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number | null;
}

export interface TimelineEntry {
  type: 'code' | 'cowork';
  sessionId: string;
  projectPath: string | null;
  startedAt: string;
  endedAt: string | null;
  turnTimestamps: string[]; // started_at of each turn (cowork only)
}

export interface TodaySummary {
  sessionCount: number;
  coworkSessionCount: number;
  codeSessionCount: number;
  coworkTurnCount: number;
  avgTurnDurationSeconds: number | null;
  codeCostUsd: number | null;
  activeTimeSeconds: number | null;
  lastFocusedAt: string | null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface InfluxConnectionProfile {
  id: string;
  name: string;
  url: string;
  bucket: string;
  org: string;
  // Token is stored encrypted via safeStorage — never returned in plaintext
  hasToken: boolean;
}

export interface AppSettings {
  // General tab
  logFilePath: string | null;          // Override for Claude Desktop log path
  claudeCodeDataPath: string | null;   // Override for ~/.claude/projects/
  minimizeToTrayOnClose: boolean;
  launchOnStartup: boolean;
  showTrayNotifications: boolean;

  // Remote Sync tab
  syncEnabled: boolean;
  activeProfileId: string | null;
  connectionProfiles: InfluxConnectionProfile[];

  // Import history
  lastChatImportAt: string | null;
  lastJsonlScanAt: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard Config
// ---------------------------------------------------------------------------

export type ViewId = 'today' | 'cowork' | 'code' | 'chat' | 'trends' | 'heatmap' | 'settings';

export type TrendsWidgetId =
  | 'cacheEfficiency'
  | 'turnDurationTrend'
  | 'costVelocity'
  | 'sessionDensity'
  | 'modelMigration'
  | 'projectActivityTimeline'
  | 'usagePatternsSummary';

export interface ViewConfig {
  id: ViewId;
  visible: boolean;
  defaultLanding: boolean;
  defaultTimeRange?: string;
  defaultSortColumn?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

export interface TrendsWidgetConfig {
  id: TrendsWidgetId;
  visible: boolean;
  order: number;
  defaultTimeRange?: string;
  defaultGranularity?: string;
}

export interface DashboardConfig {
  views: ViewConfig[];
  trendsWidgets: TrendsWidgetConfig[];
}

// ---------------------------------------------------------------------------
// Cleanup Warning
// ---------------------------------------------------------------------------

export interface CleanupWarning {
  cleanupPeriodDays: number | null;
  warningNeeded: boolean;
}

// ---------------------------------------------------------------------------
// Log Path Discovery
// ---------------------------------------------------------------------------

export type LogPathSource = 'auto-discovered' | 'settings-override' | 'not-found';

export interface LogPathStatus {
  path: string | null;
  source: LogPathSource;
  valid: boolean;
}

// ---------------------------------------------------------------------------
// Import / Sync
// ---------------------------------------------------------------------------

export interface ImportSummary {
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorCount: number;
  scanDurationMs: number;
  scannedAt: string; // ISO 8601
}

export interface SyncStatus {
  enabled: boolean;
  lastSyncAt: string | null;
  isOnline: boolean;
  pendingRows: {
    app_sessions: number;
    cowork_sessions: number;
    cowork_turns: number;
    code_sessions: number;
    chat_conversations: number;
  };
}

// ---------------------------------------------------------------------------
// Config Paths (for Settings view display)
// ---------------------------------------------------------------------------

export interface ConfigPaths {
  settingsPath: string;
  dashboardPath: string;
  databasePath: string;
  userDataPath: string;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface DailyActivity {
  date: string;          // YYYY-MM-DD
  codeCount: number;
  coworkCount: number;
  codeCost: number;      // sum of cost_usd for code sessions
  coworkTurns: number;   // sum of turns for cowork sessions
}

// ---------------------------------------------------------------------------
// Log Health Status
// ---------------------------------------------------------------------------

export interface LogHealthStatus {
  healthy: boolean;
  lastParsedAt: string | null;  // ISO 8601 timestamp of last successful parse
  fileSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Push events (main → renderer)
// ---------------------------------------------------------------------------

export interface LogEvent {
  type:
    | 'app_launch'
    | 'app_quit'
    | 'cowork_session_created'
    | 'cowork_session_cli_mapped'
    | 'cowork_turn_started'
    | 'cowork_turn_completed'
    | 'cowork_turn_ended'
    | 'app_focus';
  timestamp: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// window.api shape (defined in preload, consumed by renderer)
// ---------------------------------------------------------------------------

export interface ElectronApi {
  configPaths: {
    get(): Promise<ConfigPaths>;
    openFolder(folderPath: string): Promise<void>;
  };
  logPath: {
    getStatus(): Promise<LogPathStatus>;
  };
  data: {
    getTableCounts(): Promise<Record<string, number>>;
  };
  dev: {
    clearDatabase(): Promise<void>;
  };
  codeSessions: {
    getAll(range: DateRange): Promise<CodeSession[]>;
    getByDateRange(range: DateRange): Promise<CodeSession[]>;
    getByProject(project: string, range: DateRange): Promise<CodeSession[]>;
    getCleanupWarning(): Promise<CleanupWarning>;
  };
  coworkSessions: {
    getSummaryToday(): Promise<TodaySummary>;
    getTimeline(): Promise<TimelineEntry[]>;
    getAll(range: DateRange): Promise<CoworkSession[]>;
    getTurns(sessionId: string): Promise<CoworkTurn[]>;
  };
  settings: {
    get(): Promise<AppSettings>;
    update(partial: Partial<AppSettings>): Promise<void>;
  };
  dashboard: {
    get(): Promise<DashboardConfig>;
    save(config: DashboardConfig): Promise<void>;
  };
  chatImport: {
    start(filePath: string): Promise<ImportSummary>;
  };
  sync: {
    getStatus(): Promise<SyncStatus>;
    triggerNow(): Promise<void>;
    setToken(profileId: string, token: string): Promise<void>;
    testConnection(profileId: string): Promise<boolean>;
  };
  costs: {
    recalculate(): Promise<void>;
  };
  analytics: {
    getWeeklyActivity(): Promise<DailyActivity[]>;
  };
  // Push event subscriptions
  onLogWatcherEvent(callback: (event: LogEvent) => void): () => void;
  onLogWatcherHealth(callback: (status: LogHealthStatus) => void): () => void;
  onScanStarted(callback: () => void): () => void;
  onImportComplete(callback: (summary: ImportSummary) => void): () => void;
  onSyncStatusChanged(callback: (status: SyncStatus) => void): () => void;
}

declare global {
  interface Window {
    api: ElectronApi;
  }
}

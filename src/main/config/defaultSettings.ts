import { AppSettings } from '../../shared/ipc-types';

/**
 * Default AppSettings written on first run when settings.json does not exist.
 * The log path and code data path are null — auto-discovery runs on startup.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  logFilePath: null,
  claudeCodeDataPath: null,
  // Close-to-tray is only a safe default where the tray reliably exists.
  // On Linux a tray needs a StatusNotifier/AppIndicator host the desktop
  // may not have, so closing quits unless the user opts in (CGUI-77).
  minimizeToTrayOnClose: process.platform === 'win32',
  launchOnStartup: false,
  showTrayNotifications: true,
  chatStalenessDays: 14,
  usageLimitPollingEnabled: true,
  // Must be <= the ~60s TTL of cship usage-limits files, or polls will
  // almost always find the newest file already expired and skip it.
  usageLimitPollIntervalMs: 60_000,
  usageLimitRetentionDays: 90,
  syncEnabled: false,
  activeProfileId: null,
  connectionProfiles: [],
  lastChatImportAt: null,
  lastJsonlScanAt: null,
};

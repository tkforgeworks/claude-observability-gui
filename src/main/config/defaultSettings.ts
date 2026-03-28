import { AppSettings } from '../../shared/ipc-types';

/**
 * Default AppSettings written on first run when settings.json does not exist.
 * The log path and code data path are null — auto-discovery runs on startup.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  logFilePath: null,
  claudeCodeDataPath: null,
  minimizeToTrayOnClose: true,
  launchOnStartup: false,
  showTrayNotifications: true,
  syncEnabled: false,
  activeProfileId: null,
  connectionProfiles: [],
  lastChatImportAt: null,
  lastJsonlScanAt: null,
};

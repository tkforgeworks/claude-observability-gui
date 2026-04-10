import { app } from 'electron';

/**
 * Applies the launch-on-startup preference to the OS login items.
 * Safe to call on any platform — Electron no-ops on unsupported targets.
 */
export function applyLaunchOnStartup(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: false,
  });
}

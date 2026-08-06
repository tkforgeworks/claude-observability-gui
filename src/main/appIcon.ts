/**
 * Platform-appropriate app icon selection (CGUI-76).
 *
 * Windows uses the multi-resolution .ico (its 16/24px layers carry heavier
 * strokes for legibility). Everywhere else uses the 512px PNG master —
 * nativeImage cannot decode .ico off Windows, which left the Linux tray
 * with an invisible empty image and the window on Electron's default icon.
 *
 * Keep in sync with the icon triple (assets/icon.ico / icon.svg+png /
 * GearMark in Sidebar.tsx) — this module only selects a format, it owns no
 * geometry.
 */

import { app } from 'electron';
import path from 'path';

export function getAppIconPath(): string {
  const filename = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(app.getAppPath(), 'assets', filename);
}

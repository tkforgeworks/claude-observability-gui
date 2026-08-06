/**
 * Per-platform close-to-tray default (CGUI-77).
 *
 * Close-to-tray is only a safe default where the tray reliably exists.
 * DEFAULT_SETTINGS is computed at module load from process.platform, so each
 * case re-imports the module under an overridden platform.
 */

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function defaultsUnderPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform });
  let settings: typeof import('../config/defaultSettings').DEFAULT_SETTINGS;
  jest.isolateModules(() => {
    settings = require('../config/defaultSettings').DEFAULT_SETTINGS;
  });
  return settings!;
}

afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
});

describe('DEFAULT_SETTINGS.minimizeToTrayOnClose', () => {
  it('defaults on for Windows, where the tray always exists', () => {
    expect(defaultsUnderPlatform('win32').minimizeToTrayOnClose).toBe(true);
  });

  it('defaults off for Linux, where a tray host may be absent', () => {
    expect(defaultsUnderPlatform('linux').minimizeToTrayOnClose).toBe(false);
  });

  it('defaults off for macOS', () => {
    expect(defaultsUnderPlatform('darwin').minimizeToTrayOnClose).toBe(false);
  });
});

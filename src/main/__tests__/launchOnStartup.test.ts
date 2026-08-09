/**
 * XDG autostart on Linux (CGUI-78).
 *
 * On Linux, launch-on-startup writes/removes an autostart .desktop entry
 * instead of the (no-op) setLoginItemSettings path. Dev builds never write
 * one, and the Exec line prefers the persistent APPIMAGE path with the
 * --hidden flag for tray-first login launches.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const mockSetLoginItemSettings = jest.fn();
let mockAppData = '';
let mockIsPackaged = true;

jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name !== 'appData') throw new Error(`unexpected getPath(${name})`);
      return mockAppData;
    },
    get isPackaged() {
      return mockIsPackaged;
    },
    setLoginItemSettings: (...args: unknown[]) => mockSetLoginItemSettings(...args),
  },
}));

import {
  applyLaunchOnStartup,
  autostartFilePath,
  buildAutostartEntry,
} from '../services/launchOnStartup';

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

beforeEach(() => {
  mockAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'cgui78-'));
  mockIsPackaged = true;
  delete process.env.APPIMAGE;
});

afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
  fs.rmSync(mockAppData, { recursive: true, force: true });
  jest.clearAllMocks();
});

describe('applyLaunchOnStartup on Linux', () => {
  beforeEach(() => setPlatform('linux'));

  it('writes the autostart entry when enabled', () => {
    applyLaunchOnStartup(true);

    const file = autostartFilePath();
    expect(fs.existsSync(file)).toBe(true);
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('[Desktop Entry]');
    expect(content).toContain(`Exec="${process.execPath}" --hidden`);
    expect(mockSetLoginItemSettings).not.toHaveBeenCalled();
  });

  it('removes the autostart entry when disabled', () => {
    applyLaunchOnStartup(true);
    expect(fs.existsSync(autostartFilePath())).toBe(true);

    applyLaunchOnStartup(false);
    expect(fs.existsSync(autostartFilePath())).toBe(false);
  });

  it('is a no-op when disabling with no entry present', () => {
    expect(() => applyLaunchOnStartup(false)).not.toThrow();
  });

  it('never writes an entry from a dev build', () => {
    mockIsPackaged = false;
    applyLaunchOnStartup(true);
    expect(fs.existsSync(autostartFilePath())).toBe(false);
  });

  it('prefers the persistent APPIMAGE path over execPath', () => {
    process.env.APPIMAGE = '/home/user/Apps/claude-usage-monitor.AppImage';
    expect(buildAutostartEntry()).toContain(
      'Exec="/home/user/Apps/claude-usage-monitor.AppImage" --hidden'
    );
  });
});

describe('applyLaunchOnStartup on Windows', () => {
  beforeEach(() => setPlatform('win32'));

  it('delegates to setLoginItemSettings and writes no file', () => {
    applyLaunchOnStartup(true);
    expect(mockSetLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      openAsHidden: false,
    });
    expect(fs.existsSync(autostartFilePath())).toBe(false);
  });
});

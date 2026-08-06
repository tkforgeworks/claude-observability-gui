/**
 * Platform gating for Claude Desktop log discovery (CGUI-75).
 *
 * On platforms without Claude Desktop, getLogPathStatus must report
 * 'unsupported-platform' (an expected state the renderer keeps banner-free),
 * never 'not-found' (an error state) — while a settings override keeps
 * working everywhere as the escape hatch.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

jest.mock('../config/configStore', () => ({
  loadSettings: jest.fn(),
}));

import { loadSettings } from '../config/configStore';
import { discoverLogPath, getLogPathStatus } from '../services/logPathDiscovery';

const mockLoadSettings = loadSettings as jest.Mock;

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
  jest.clearAllMocks();
});

describe('getLogPathStatus on non-Windows platforms', () => {
  beforeEach(() => setPlatform('linux'));

  it('reports unsupported-platform instead of not-found when no override is set', () => {
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    discoverLogPath();

    expect(getLogPathStatus()).toEqual({
      path: null,
      source: 'unsupported-platform',
      valid: false,
    });
  });

  it('still honours a settings override pointing at a real file', () => {
    const tmpLog = path.join(os.tmpdir(), `cgui75-test-${process.pid}.log`);
    fs.writeFileSync(tmpLog, 'log line\n');
    try {
      mockLoadSettings.mockReturnValue({ logFilePath: tmpLog });

      expect(getLogPathStatus()).toEqual({
        path: tmpLog,
        source: 'settings-override',
        valid: true,
      });
    } finally {
      fs.unlinkSync(tmpLog);
    }
  });

  it('skips MSIX auto-discovery entirely', () => {
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    expect(discoverLogPath()).toBeNull();
  });
});

describe('getLogPathStatus on Windows', () => {
  beforeEach(() => setPlatform('win32'));

  it('reports not-found (not unsupported) when discovery finds nothing', () => {
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    // No LOCALAPPDATA in the test env → discovery yields nothing
    delete process.env.LOCALAPPDATA;
    discoverLogPath();

    expect(getLogPathStatus()).toEqual({
      path: null,
      source: 'not-found',
      valid: false,
    });
  });
});

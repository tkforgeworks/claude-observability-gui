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
  MANAGED_KEY,
  applyLaunchOnStartup,
  autostartFilePath,
  buildAutostartEntry,
  getAutostartInfo,
  quoteExecArg,
  shellQuote,
  stableAppImageLauncher,
} from '../services/launchOnStartup';

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

beforeEach(() => {
  mockAppData = fs.mkdtempSync(path.join(os.tmpdir(), 'cgui78-'));
  mockIsPackaged = true;
  delete process.env.APPIMAGE;
  delete process.env.ARGV0;
  delete process.env.OWD;
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

  // CGUI-93: the default setting is false and applyLaunchOnStartup runs on
  // every launch, so removal must never touch an entry we didn't write.
  it('stamps the entry it writes with the managed marker', () => {
    applyLaunchOnStartup(true);
    expect(fs.readFileSync(autostartFilePath(), 'utf-8')).toContain(`${MANAGED_KEY}=true`);
  });

  it('leaves a user-authored entry of the same name alone when disabled', () => {
    const file = autostartFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const foreign = '[Desktop Entry]\nType=Application\nName=Claude Usage Monitor\nExec=claude-usage-monitor\n';
    fs.writeFileSync(file, foreign);

    applyLaunchOnStartup(false);

    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf-8')).toBe(foreign);
  });

  it('Desktop-Entry-escapes hostile characters in the Exec path', () => {
    process.env.APPIMAGE = '/home/u/Apps/100%/we"ird$ `dir\\x/claude-usage-monitor.AppImage';
    const line = buildAutostartEntry().split('\n').find(l => l.startsWith('Exec='));
    // % doubled; " $ ` backslash-escaped at the quoting layer, and every
    // backslash doubled again at the desktop-file string layer.
    expect(line).toBe(
      'Exec="/home/u/Apps/100%%/we\\\\"ird\\\\$ \\\\`dir\\\\\\\\x/claude-usage-monitor.AppImage" --hidden'
    );
  });

  it('leaves an ordinary path untouched apart from the quotes', () => {
    expect(quoteExecArg('/opt/Claude Usage Monitor/claude-usage-monitor')).toBe(
      '"/opt/Claude Usage Monitor/claude-usage-monitor"'
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

/**
 * CGUI-140: the AppImage runtime resolves APPIMAGE to the real, versioned
 * file even when the user launched through a stable symlink, so the entry
 * must prefer the launcher the user actually ran (ARGV0) when it resolves to
 * the same AppImage.
 */
describe('stable AppImage launcher (CGUI-140)', () => {
  let root: string;
  let appImage: string;
  let launcher: string;

  beforeEach(() => {
    setPlatform('linux');
    // ~/.local/bin/cog -> ../opt/cog/current/cog.AppImage, current -> 2.0.0
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cgui140-')));
    const versionDir = path.join(root, 'opt', 'cog', '2.0.0');
    fs.mkdirSync(versionDir, { recursive: true });
    appImage = path.join(versionDir, 'cog.AppImage');
    fs.writeFileSync(appImage, '');
    fs.symlinkSync('2.0.0', path.join(root, 'opt', 'cog', 'current'));
    fs.mkdirSync(path.join(root, 'bin'));
    launcher = path.join(root, 'bin', 'cog');
    fs.symlinkSync('../opt/cog/current/cog.AppImage', launcher);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('returns an absolute ARGV0 that resolves to the running AppImage', () => {
    expect(stableAppImageLauncher(appImage, launcher, {})).toBe(launcher);
  });

  it('resolves a relative ARGV0 against OWD', () => {
    expect(stableAppImageLauncher(appImage, './bin/cog', { OWD: root })).toBe(launcher);
  });

  it('resolves a bare ARGV0 through PATH', () => {
    const PATH = ['/nonexistent', path.join(root, 'bin')].join(':');
    expect(stableAppImageLauncher(appImage, 'cog', { PATH })).toBe(launcher);
  });

  it('returns null when ARGV0 is the AppImage itself or missing', () => {
    expect(stableAppImageLauncher(appImage, appImage, {})).toBeNull();
    expect(stableAppImageLauncher(appImage, undefined, {})).toBeNull();
  });

  it('returns null when ARGV0 resolves to a different file', () => {
    const other = path.join(root, 'bin', 'other');
    fs.writeFileSync(other, '');
    expect(stableAppImageLauncher(appImage, other, {})).toBeNull();
  });

  it('writes the stable launcher into the autostart entry', () => {
    process.env.APPIMAGE = appImage;
    process.env.ARGV0 = launcher;
    expect(buildAutostartEntry()).toContain(`Exec="${launcher}" --hidden`);
  });

  it('falls back to APPIMAGE when there is no stable launcher', () => {
    process.env.APPIMAGE = appImage;
    process.env.ARGV0 = appImage;
    expect(buildAutostartEntry()).toContain(`Exec="${appImage}" --hidden`);
  });
});

/**
 * CGUI-139: standalone compositors never run XDG autostart entries, so
 * Settings needs to know when to show the manual-startup hint.
 */
describe('getAutostartInfo (CGUI-139)', () => {
  const never = () => false;

  beforeEach(() => setPlatform('linux'));

  it('flags a standalone compositor as not honouring autostart', () => {
    const info = getAutostartInfo({ XDG_CURRENT_DESKTOP: 'Hyprland' }, never);
    expect(info.desktop).toBe('Hyprland');
    expect(info.likelyHonoured).toBe(false);
  });

  it('recognises full desktops from any XDG_CURRENT_DESKTOP token', () => {
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' }, never).likelyHonoured).toBe(true);
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'KDE' }, never).likelyHonoured).toBe(true);
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'X-Cinnamon' }, never).likelyHonoured).toBe(true);
  });

  it('treats an active systemd autostart target (uwsm) as honoured', () => {
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'Hyprland' }, () => true).likelyHonoured).toBe(true);
  });

  it('treats a missing XDG_CURRENT_DESKTOP as not honoured', () => {
    const info = getAutostartInfo({}, never);
    expect(info.desktop).toBeNull();
    expect(info.likelyHonoured).toBe(false);
  });

  it('offers the shell-quoted login command in packaged builds only', () => {
    process.env.APPIMAGE = '/home/u/My Apps/cog.AppImage';
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'Hyprland' }, never).command).toBe(
      "'/home/u/My Apps/cog.AppImage' --hidden"
    );
    mockIsPackaged = false;
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'Hyprland' }, never).command).toBeNull();
  });

  it('reports nothing off Linux', () => {
    setPlatform('win32');
    expect(getAutostartInfo({ XDG_CURRENT_DESKTOP: 'Hyprland' }, never)).toEqual({
      desktop: null,
      likelyHonoured: null,
      command: null,
    });
  });

  it('shell-quotes only when needed, escaping single quotes', () => {
    expect(shellQuote('/home/u/.local/bin/cog')).toBe('/home/u/.local/bin/cog');
    expect(shellQuote("/home/u/it's here/cog")).toBe("'/home/u/it'\\''s here/cog'");
  });
});

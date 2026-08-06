/**
 * Platform-appropriate icon format selection (CGUI-76).
 *
 * .ico only decodes on Windows; every other platform must get the PNG or
 * the tray renders an invisible empty image (CGUI-61 section A).
 */

import path from 'path';

jest.mock('electron', () => ({
  app: { getAppPath: () => '/fake/approot' },
}));

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function iconPathUnderPlatform(platform: NodeJS.Platform): string {
  Object.defineProperty(process, 'platform', { value: platform });
  let result: string;
  jest.isolateModules(() => {
    result = require('../appIcon').getAppIconPath();
  });
  return result!;
}

afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
});

describe('getAppIconPath', () => {
  it('selects the multi-resolution .ico on Windows', () => {
    expect(iconPathUnderPlatform('win32')).toBe(
      path.join('/fake/approot', 'assets', 'icon.ico')
    );
  });

  it('selects the PNG on Linux', () => {
    expect(iconPathUnderPlatform('linux')).toBe(
      path.join('/fake/approot', 'assets', 'icon.png')
    );
  });

  it('selects the PNG on macOS', () => {
    expect(iconPathUnderPlatform('darwin')).toBe(
      path.join('/fake/approot', 'assets', 'icon.png')
    );
  });
});
